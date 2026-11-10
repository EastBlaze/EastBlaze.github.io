// Extra tokenizer checks do not change the 30-case retrieval corpus or its metrics.
import { PreTrainedTokenizer } from '@huggingface/transformers';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenizeE5 } from './encoders.mjs';
const root = dirname(fileURLToPath(import.meta.url));
const models = resolve(process.env.MODELS_DIR || resolve(root, 'models'));
const entries = [];
for (const [method, directory] of [['static64', 'static'], ['e5tiny', 'e5']]) {
  const data = JSON.parse(await readFile(resolve(models, directory, 'tokenizer.json'), 'utf8'));
  const config = method === 'e5tiny' ? JSON.parse(await readFile(resolve(models, directory, 'tokenizer_config.json'), 'utf8')) : {};
  const tokenizer = new PreTrainedTokenizer(data, { ...config, model_max_length: 512 });
  for (const count of [0, 507, 508, 509, 510, 511, 512, 513]) {
    const text = 'a '.repeat(count);
    const input = method === 'e5tiny' ? 'query: ' + text : text;
    const full = tokenizer(input, { add_special_tokens: method === 'e5tiny', truncation: false });
    const value = method === 'e5tiny' ? tokenizeE5(tokenizer, text).data : full;
    entries.push({ method, text, fullTokens: full.input_ids.data.length, ids: Array.from(value.input_ids.data, Number) });
  }
}
console.log(JSON.stringify(entries));
