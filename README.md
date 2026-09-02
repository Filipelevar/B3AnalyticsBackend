# B3 Analytics Backend

Backend da plataforma B3 Analytics. A API recebe os ativos e o período selecionado pelo frontend, consulta os preços históricos, normaliza os dados e devolve uma estrutura pronta para alimentar o gráfico.

O projeto já está publicado em produção. Para testar, basta utilizar a `Base URL` informada junto com a aplicação. Não é necessário instalar dependências, configurar PostgreSQL ou executar migrations.

## Stack

- Node.js e TypeScript
- Fastify
- PostgreSQL com Prisma
- JWT e `bcryptjs` para autenticação
- Yahoo Finance Chart API como provider de cotações

## API Endpoints

### `GET /health`

Verifica se o backend está online.

Este endpoint não exige autenticação.

Exemplo:

```http
GET {BASE_URL}/health
```

Resposta esperada:

```json
{
	"status": "ok",
	"message": "B3 Analytics API is running"
}
```

### `GET /assets/history`

Consulta preços históricos de um ou mais ativos da B3.

Parâmetros obrigatórios:

- `symbols`: ativos separados por vírgula, como `PETR4` ou `PETR4,VALE3`.
- `startDate`: data inicial no formato `YYYY-MM-DD`.
- `endDate`: data final no formato `YYYY-MM-DD`.

Exemplo:

```http
GET {BASE_URL}/assets/history?symbols=PETR4,VALE3&startDate=2025-08-01&endDate=2025-08-31
```

Resposta:

```json
{
	"data": [
		{
			"date": "2025-08-01",
			"PETR4": 32.21,
			"VALE3": 53.75
		}
	]
}
```

Cada item representa um dia de negociação. Quando vários ativos são enviados, seus preços aparecem no mesmo item de `data`, permitindo que o frontend construa um único gráfico com várias linhas.

Validações aplicadas pelo backend:

- Os três parâmetros são obrigatórios.
- As datas devem existir e seguir o formato `YYYY-MM-DD`.
- `startDate` deve ser anterior ou igual a `endDate`.
- O período máximo é de cinco anos.
- Uma consulta aceita no máximo dez ativos.

Principais respostas:

- `200 OK`: consulta realizada com sucesso.
- `400 Bad Request`: parâmetros ausentes ou inválidos.
- `404 Not Found`: ativo inexistente ou período sem dados.
- `502 Bad Gateway`: erro no provider externo de cotações.

### `POST /auth/register`

Cria uma nova conta de usuário.

Corpo da requisição:

```json
{
	"name": "Jane Doe",
	"email": "jane@example.com",
	"password": "a-secure-password"
}
```

Resposta de sucesso (`201 Created`):

```json
{
	"user": {
		"id": "user-id",
		"name": "Jane Doe",
		"email": "jane@example.com"
	},
	"token": "jwt-token"
}
```

O e-mail deve ser único. A senha é armazenada como hash com `bcryptjs`, e o campo interno `passwordHash` nunca é enviado na resposta.

### `POST /auth/login`

Autentica um usuário já cadastrado.

Corpo da requisição:

```json
{
	"email": "jane@example.com",
	"password": "a-secure-password"
}
```

Resposta de sucesso (`200 OK`):

```json
{
	"user": {
		"id": "user-id",
		"name": "Jane Doe",
		"email": "jane@example.com"
	},
	"token": "jwt-token"
}
```

O `token` é um JWT com validade de uma hora. Em caso de credenciais inválidas, a API retorna `401 Unauthorized`.

## Como funciona o login

1. O usuário realiza o cadastro em `POST /auth/register`.
2. O backend valida os dados e salva a senha como hash no PostgreSQL.
3. O usuário realiza o login em `POST /auth/login` enviando `email` e `password`.
4. O backend compara a senha informada com o hash salvo.
5. Se as credenciais estiverem corretas, a API retorna um JWT.
6. O frontend pode armazenar o token para utilizá-lo em futuras requisições autenticadas.

O endpoint de consulta de mercado está disponível para o fluxo principal da demonstração. O login existe como base de autenticação da aplicação, mas a consulta histórica não precisa de token neste momento.

## Como funciona a consulta de mercado

1. O frontend envia os ativos e as datas para `GET /assets/history`.
2. O backend valida os parâmetros.
3. O sistema verifica se os dados já estão no cache do PostgreSQL.
4. Se não estiverem, consulta o Yahoo Finance Chart API.
5. O backend transforma a resposta externa para o contrato da própria aplicação.
6. Os dados são armazenados no cache e retornados ao frontend.

O frontend não depende do formato do Yahoo Finance. Se o provider externo for trocado no futuro, o contrato de `GET /assets/history` pode continuar igual.

## Tratamento de dados

O cache utiliza as tabelas `MarketData` e `MarketDataCoverage`.

- `MarketData` armazena o preço de fechamento (`close`) por ativo (`symbol`) e data (`date`).
- `MarketDataCoverage` registra períodos que já foram consultados.
- A combinação `symbol + date` é única, evitando duplicidade.

Essa estratégia reduz chamadas desnecessárias ao provider externo e melhora o tempo de resposta para consultas repetidas.

## Observação para execução local

A aplicação publicada não exige nenhuma configuração para ser avaliada. As variáveis de ambiente, a conexão com PostgreSQL e a chave do JWT são responsabilidades do ambiente de produção.
