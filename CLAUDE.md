# Almanac

## O que é
Ferramenta de feedback ancorado em página web: o usuário fixa um comentário num
ponto específico da página (pin-anchored feedback). Construído a partir de um
`SEED.md`, que implementa seis requisitos obrigatórios (R1 a R6) e a jornada de
aceitação descrita na seção 4 daquele documento.

## Modo
MANUTENÇÃO.

Estado em 25/07/2026: NÃO existe teste no projeto, e `node_modules` não está
instalado. Isso é notável aqui, porque o `SEED.md` define uma jornada de
aceitação: existe critério escrito, mas nada mecânico verificando.

## Branches
- Principal: `main`
- Integração: `dev`
- Deploy automático na principal: nenhuma configuração no repositório.
- Promoção para a principal e deploy são do Jeann, nunca meus.

## Stack
- Next.js (App Router), React, TypeScript (`next.config.ts`)
- `lucide-react` para ícones
- `middleware.ts` na raiz
- Node, npm (`package-lock.json`)

## Comandos
- Dev: `npm run dev`
- Build: `npm run build`
- Start do build: `npm run start`
- Lint: `npm run lint` (next lint)
- Checagem de tipos: `npm run typecheck` (`tsc --noEmit`)
- Testes: não existe
- Cobertura: não existe

## Arquitetura real deste projeto
Next.js App Router: `app/` com as rotas, `components/` com a UI, `lib/` com o
apoio, `middleware.ts` na borda.

## Desvios conscientes do padrão global
1. **Sem teste algum**, apesar de existir jornada de aceitação escrita no
   `SEED.md`. Os requisitos R1 a R6 são candidatos naturais a virar suíte: cada
   um vira um teste. Proponha antes de implementar comportamento novo.
2. **Sem cobertura**, por consequência.

## Vocabulário de domínio
- **Pin**: âncora que prende o comentário a um ponto da página.
- **SEED.md**: documento fonte que define os requisitos R1 a R6 e a jornada de
  aceitação. É a especificação; leia antes de mudar comportamento.
- **R1 a R6**: os seis requisitos obrigatórios.

## Armadilhas conhecidas
1. **É repositório PÚBLICO.** Nada de dado pessoal ou credencial, nem em teste.
2. O `SEED.md` é a fonte de verdade do escopo. Antes de dizer que algo está
   pronto, confira contra os requisitos R1 a R6, não contra a impressão de que
   funciona.
