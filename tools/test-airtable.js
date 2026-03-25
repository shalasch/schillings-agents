/**
 * tools/test-airtable.js
 * Testa conexão com o Airtable e lista todos os alunos.
 *
 * Uso: node tools/test-airtable.js
 */

import { getAlunos } from '../bot/airtable.js';

try {
  console.log('Buscando alunos no Airtable...\n');

  const alunos = await getAlunos();

  console.log(`Total de registros: ${alunos.length}\n`);

  for (const aluno of alunos) {
    console.log(`Nome:     ${aluno.nome     || '(vazio)'}`);
    console.log(`Telefone: ${aluno.telefone || '(vazio)'}`);
    console.log(`Email:    ${aluno.email    || '(vazio)'}`);
    console.log('---');
  }
} catch (err) {
  console.error('Erro ao conectar com o Airtable:');
  console.error(err.message);
  process.exit(1);
}
