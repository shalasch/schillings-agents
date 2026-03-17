# Evolution API v2 — Debug Report

**Projeto:** Schilling's Agents
**Data:** 17/03/2026
**Objetivo:** Subir a Evolution API v2 com PostgreSQL via Docker para integração com WhatsApp

---

## Resumo

Processo de diagnóstico e resolução de 6 erros encadeados ao configurar a Evolution API v2 (atendai/evolution-api:latest) com Docker no Windows 11. Cada erro revelou uma camada mais profunda do problema real.

---

## Erro 1 — Container inexistente

**Sintoma:**
```
docker: Error response from daemon: Conflict. The container name "/evolution-api" is already in use
```

**Causa:** Container antigo existia parado de uma tentativa anterior.

**Fix:**
```bash
docker start evolution-api
# ou, se precisar recriar:
docker rm evolution-api
```

---

## Erro 2 — `Error: Database provider invalid`

**Sintoma:** Container reiniciava em loop com:
```
Error: Database provider invalid.
```

**Causa:** A Evolution API v2 exige uma variável `DATABASE_PROVIDER` configurada. Sem ela, o container falha no boot.

**Fix:**
```bash
docker run -e DATABASE_PROVIDER=postgresql ...
```

> **Aprendizado:** A Evolution API v2 não tem defaults silenciosos — variáveis obrigatórias ausentes causam crash imediato.

---

## Erro 3 — `P1001: Can't reach database server at host.docker.internal:5432`

**Sintoma:**
```
Error: P1001: Can't reach database server at `host.docker.internal:5432`
```

**Causa:** A imagem tinha um `.env` interno configurado para `host.docker.internal` (hostname especial do Docker Desktop que aponta pro host físico). Não havia PostgreSQL rodando no host.

**Fix:** Mover para `docker-compose.yml` com PostgreSQL como serviço separado na mesma rede Docker:

```yaml
services:
  postgres:
    image: postgres:16
  evolution-api:
    depends_on:
      postgres:
        condition: service_healthy
```

> **Aprendizado:** Em Docker Compose, containers se comunicam pelo nome do serviço (DNS interno), não por `localhost` ou `host.docker.internal`.

---

## Erro 4 — `P1000: Authentication failed` (loop interminável)

**Sintoma:**
```
Error: P1000: Authentication failed against database server at `postgres`,
the provided database credentials for `user` are not valid.
```

**Causa raiz (mais sutil):** A Evolution API v2 carrega um arquivo `.env` **interno** da imagem via `dotenv.config()` dentro do script de migração. O Prisma, ao rodar as migrations, lê esse `.env` interno — que tinha credenciais padrão `user:password` — em vez das variáveis passadas pelo Docker (`-e` ou `environment:`).

Tentativas que **não** funcionaram:
- Passar `DATABASE_URL` via `environment:` no compose → ignorado pelo Prisma
- Usar `env_file:` no compose → variáveis chegavam ao Node.js mas não sobrescreviam o `.env` interno lido pelo Prisma
- Mudar credenciais do Postgres para `user:password` → ainda falhava porque o volume tinha dados antigos
- Limpar volume com `docker compose down -v` → resolveu volume, mas o Prisma ainda lia o `.env` interno

**Fix definitivo:** Montar o nosso arquivo de configuração diretamente sobre o `.env` interno do container:

```yaml
volumes:
  - ./evolution.env:/evolution/.env  # sobrescreve o .env interno
```

> **Aprendizado:** Variáveis de ambiente Docker (`-e`) não sobrescrevem arquivos `.env` lidos diretamente pelo Prisma. Para sobrescrever, é necessário um bind mount no path exato do arquivo interno.

---

## Erro 5 — `P1012: Environment variable not found: DATABASE_CONNECTION_URI`

**Sintoma** (após montar o `.env`):
```
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Environment variable not found: DATABASE_CONNECTION_URI.
  -->  prisma/postgresql-schema.prisma:13
```

**Causa:** O schema Prisma da Evolution API v2 usa `DATABASE_CONNECTION_URI` — não `DATABASE_URL` como é padrão na maioria dos projetos Prisma.

**Fix:** Renomear a variável no `evolution.env`:

```env
# Errado:
DATABASE_URL=postgresql://...

# Correto:
DATABASE_CONNECTION_URI=postgresql://evuser:evpass@evolution-postgres:5432/evolution?schema=public
```

> **Aprendizado:** Sempre verificar o `schema.prisma` da dependência para saber o nome exato da variável de ambiente esperada. Não assumir que é `DATABASE_URL`.

---

## Erro 6 — Volume com dados obsoletos

**Sintoma:** Mesmo após trocar credenciais, o Postgres rejeitava autenticação.

**Causa:** O volume Docker persistia dados de uma inicialização anterior com credenciais diferentes. O Postgres não reinicializa `POSTGRES_USER`/`POSTGRES_PASSWORD` se o diretório de dados já existir.

**Fix:**
```bash
docker compose down -v          # remove containers E volumes
docker volume rm <volume_name>  # força remoção se ainda em uso
docker compose up -d
```

> **Aprendizado:** Ao trocar credenciais do Postgres em Docker, sempre limpar o volume. Dados persistidos têm prioridade sobre variáveis de ambiente de inicialização.

---

## Configuração Final Funcionando

**`docker-compose.yml`:**
```yaml
services:
  evolution-postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: evuser
      POSTGRES_PASSWORD: evpass
      POSTGRES_DB: evolution
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U evuser -d evolution"]
      interval: 10s
      timeout: 5s
      retries: 5

  evolution-api:
    image: atendai/evolution-api:latest
    ports:
      - "8080:8080"
    volumes:
      - ./evolution.env:/evolution/.env   # chave do problema
    depends_on:
      evolution-postgres:
        condition: service_healthy
```

**`evolution.env`:**
```env
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evuser:evpass@evolution-postgres:5432/evolution?schema=public
AUTHENTICATION_API_KEY=schillings123
```

---

## Linha do Tempo dos Erros

| # | Erro | Tipo |
|---|------|------|
| 1 | Container name conflict | Docker básico |
| 2 | Database provider invalid | Config ausente |
| 3 | Can't reach host.docker.internal | Rede Docker |
| 4 | Authentication failed (loop) | `.env` interno sobrescrevendo Docker env |
| 5 | DATABASE_CONNECTION_URI not found | Nome de variável incorreto |
| 6 | Volume com dados obsoletos | Persistência Docker |

---

## Conclusão

O problema central era que a Evolution API v2 carrega seu próprio `.env` interno via Prisma, ignorando variáveis de ambiente Docker convencionais para a etapa de migration. A solução — montar um arquivo `.env` externo sobre o interno via bind mount — é uma técnica pouco documentada mas essencial para containers que usam Prisma com `.env` embutido.
