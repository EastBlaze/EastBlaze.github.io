import { normalize } from './core.mjs';

const plain = value => Array.from(value.input_ids.data, Number);

export function staticWeights(bytes) {
  if (bytes.byteLength < 8) throw new Error('Truncated static tensor header');
  const size = Number(new DataView(bytes).getBigUint64(0, true));
  if (!Number.isSafeInteger(size) || size > bytes.byteLength - 8) throw new Error('Invalid static tensor header');
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 8, size)));
  const entry = header['embedding.weight'];
  const expected = 32000 * 64 * 4;
  if (entry?.dtype !== 'F32' || entry.shape?.[0] !== 32000 || entry.shape?.[1] !== 64 ||
      entry.shape.length !== 2 || !Array.isArray(entry.data_offsets)) throw new Error('Unexpected static tensor');
  const [start, end] = entry.data_offsets;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 ||
      end - start !== expected || end > bytes.byteLength - 8 - size || (8 + size + start) % 4) {
    throw new Error('Invalid static tensor offsets');
  }
  return new Float32Array(bytes, 8 + size + start, expected / 4);
}

export function tokenizeE5(tokenizer, text, kind = 'query') {
  const full = tokenizer(`${kind}: ${text}`, { truncation: false });
  const data = tokenizer(`${kind}: ${text}`, { truncation: true, max_length: 512 });
  // Match the independent Rust single-sequence tokenizer at the truncation boundary.
  if (full.input_ids.data.length > 512) data.input_ids.data[511] = full.input_ids.data.at(-1);
  return { full, data };
}

export function createEncoders({ PreTrainedTokenizer, ort, readJson, readBytes }) {
  const makeTokenizer = (data, config = {}) => new PreTrainedTokenizer(data, { ...config, model_max_length: 512 });
  return {
    static64: async () => {
      const start = performance.now();
      const tokenizer = makeTokenizer(await readJson('/models/static/tokenizer.json'), {
        unk_token: '[UNK]', pad_token: '[PAD]', cls_token: '[CLS]', sep_token: '[SEP]',
      });
      const weights = staticWeights(await readBytes('/models/static/model.safetensors'));
      return {
        loadMs: performance.now() - start,
        encode: async text => {
          const ids = plain(tokenizer(text, { add_special_tokens: false, truncation: false }));
          const sum = new Float64Array(64);
          for (const id of ids) {
            if (!Number.isInteger(id) || id < 0 || id >= 32000) throw new Error(`Invalid token ID: ${id}`);
            for (let j = 0; j < 64; j++) sum[j] += weights[id * 64 + j];
          }
          return { vector: normalize(sum), tokens: ids.length, usedTokens: ids.length, truncated: false, ids };
        },
      };
    },
    e5tiny: async () => {
      const start = performance.now();
      const tokenizer = makeTokenizer(await readJson('/models/e5/tokenizer.json'), await readJson('/models/e5/tokenizer_config.json'));
      const session = await ort.InferenceSession.create(await readBytes('/models/e5/onnx/model_qint8_arm64.onnx'), {
        executionProviders: ['wasm'], graphOptimizationLevel: 'all',
      });
      return {
        loadMs: performance.now() - start, inputs: session.inputNames, outputs: session.outputNames,
        dispose: () => session.release(),
        encode: async (text, kind = 'query') => {
          const { full, data } = tokenizeE5(tokenizer, text, kind);
          const feeds = {};
          for (const name of session.inputNames) {
            if (data[name]) feeds[name] = new ort.Tensor('int64', data[name].data, data[name].dims);
            else if (name === 'token_type_ids') feeds[name] = new ort.Tensor('int64', new BigInt64Array(data.input_ids.data.length), data.input_ids.dims);
            else throw new Error(`Missing input ${name}`);
          }
          let output;
          try {
            output = await session.run(feeds);
            const tensor = output.last_hidden_state || output[session.outputNames[0]];
            if (tensor.dims.length !== 3 || tensor.dims[0] !== 1 || tensor.dims[2] !== 384 ||
                tensor.dims[1] !== data.attention_mask.data.length) throw new Error(`Unexpected output shape ${tensor.dims}`);
            const [, seq, dim] = tensor.dims;
            const sum = new Float64Array(dim);
            for (let i = 0; i < seq; i++) if (Number(data.attention_mask.data[i])) {
              for (let j = 0; j < dim; j++) sum[j] += tensor.data[i * dim + j];
            }
            // Sum then normalize equals masked mean then normalize.
            return { vector: normalize(sum), tokens: full.input_ids.data.length,
              usedTokens: seq, truncated: full.input_ids.data.length > seq, ids: plain(data) };
          } finally {
            for (const tensor of Object.values(feeds)) tensor.dispose?.();
            for (const tensor of Object.values(output || {})) tensor.dispose?.();
          }
        },
      };
    },
  };
}
