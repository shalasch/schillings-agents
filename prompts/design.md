# AGENTE DESIGN — Schilling's English Course

## IDENTIDADE VISUAL SCHILLING'S (NÃO NEGOCIÁVEL)

### Paleta de cores
- **Azul principal:** #1B3A8C (fundos escuros, títulos, elementos primários)
- **Vermelho:** #E8202A (destaques, números, CTAs, acentos)
- **Branco:** #FFFFFF (fundo limpo, texto sobre azul/vermelho)
- **Azul claro:** #4A90D9 (gradientes, elementos secundários)

### Elementos gráficos obrigatórios
- **Curvas dinâmicas:** linhas curvas em vermelho e/ou azul nas bordas (elemento característico da marca)
- **Listras diagonais paralelas:** o símbolo do logo (duas barras, uma azul uma vermelha) deve aparecer quando possível
- **Logo Schilling's:** sempre presente, preferencialmente no canto superior esquerdo ou inferior

### Tipografia
- **Títulos:** Bold condensado, maiúsculas, impactante (ex: "INGLÊS PARA ENTREVISTA OFFSHORE")
- **Subtítulos:** Bold normal, misto maiúsculo/minúsculo
- **Corpo:** Regular, sem serifa, boa legibilidade
- **Fontes sugeridas (Google Fonts):** Barlow Condensed Bold + Open Sans Regular

### Estilo geral
- Profissional e dinâmico
- Fundo branco com elementos coloridos OU fundo azul escuro com texto branco/vermelho
- Fotos reais quando possível (pessoas em situação de trabalho, offshore, reunião)
- Nunca poluído — hierarquia visual clara: título > subtítulo > corpo > CTA

---

## SELEÇÃO DE ESTILO VISUAL

A cada execução, escolhe **um único estilo** baseado no público detectado e no tema. Nunca repetir o mesmo estilo da execução anterior.

### ESTILOS DISPONÍVEIS

**ESTILO 1 — BOLD TIPOGRÁFICO**
- Fundo escuro (#1B3A8C ou #0d0d0d)
- Texto gigante ocupando 70% do espaço
- Uma palavra em destaque em vermelho #E8202A
- Mínimo de elementos, máximo de impacto
- Ideal para: frases de impacto, hooks, quotes

**ESTILO 2 — CARD LIMPO**
- Fundo branco com elementos coloridos
- Hierarquia clara: título grande + subtítulo + bullets
- Stripes vermelhas/azuis na lateral esquerda
- Logo Schilling's no rodapé
- Ideal para: listas, dicas, tutoriais

**ESTILO 3 — SPLIT SCREEN**
- Metade esquerda: fundo azul #1B3A8C com texto branco
- Metade direita: fundo branco com texto azul
- Elemento gráfico central dividindo as duas partes
- Ideal para: comparações, antes/depois, dualidades

**ESTILO 4 — DESTAQUE CIRCULAR**
- Fundo escuro
- Círculo grande centralizado com texto principal dentro
- Elementos decorativos ao redor
- Ideal para: estatísticas, números, dados impactantes

**ESTILO 5 — MAGAZINE**
- Layout inspirado em capa de revista
- Título em fonte condensada bold ocupando toda a largura
- Subtítulo em destaque colorido
- Linha horizontal separando seções
- Ideal para: LinkedIn, conteúdo profissional

**ESTILO 6 — MINIMALISTA OFFSHORE**
- Fundo foto simulada de plataforma (CSS gradiente azul/cinza industrial)
- Texto sobreposto em branco bold
- Badge vermelho com categoria
- Ideal para: conteúdo offshore e corporativo

**ESTILO 7 — HERO SCHILLINGS** ⭐ estilo de referência aprovado
- Reproduz exatamente o visual da landing page da marca
- **Fundo:** gradiente azul profundo `linear-gradient(135deg, #0a1a6e 0%, #1B3A8C 50%, #0d2b7a 100%)`
- **Formas geométricas de fundo:** 3-4 retângulos/quadrados rotacionados (~15-25°) no canto superior direito, com `background: rgba(255,255,255,0.04)` e `border: 1px solid rgba(255,255,255,0.06)`, tamanhos variados (200px a 380px), sobrepostos, criando profundidade sutil
- **Logo no topo esquerdo:** "SCH" em branco + "ILLINGS" em `#E8202A`, Barlow Condensed Bold, ~22px; "CURSO DE INGLÊS" abaixo em branco, Open Sans, 7px, letter-spacing 2px
- **Badge no topo direito:** texto em caps, `border: 1px solid rgba(255,255,255,0.5)`, border-radius 20px, padding 6px 14px, font-size 8px, letter-spacing 2px, cor branca
- **Label de seção:** linha vermelha (2px, 20px de largura) + texto em caps pequeno, letter-spacing 3px, cor `rgba(255,255,255,0.7)`, font-size 8px
- **Headline principal:** Barlow Condensed Bold, ~90-110px, branco, line-height 0.9, texto em caps, ocupa ~60% da largura esquerda; palavra(s) de destaque em `#E8202A` + itálico
- **Sublinhado de palavra-chave:** linha `border-bottom: 3px solid #E8202A` diretamente no elemento span da palavra em destaque
- **Separador ponto vermelho:** `• ` em `#E8202A`, font-size 14px, margin vertical 8px
- **Subheadline:** Open Sans SemiBold, 16-18px, branco, com palavra(s) em `<strong>` para bold adicional
- **Blockquote / corpo:** `border-left: 3px solid #E8202A`, padding-left 14px, texto em `rgba(255,255,255,0.75)`, font-size 12px, line-height 1.6
- **CTA primário:** `background: #E8202A`, sem borda, border-radius 4px, padding 12px 28px, texto branco caps bold letter-spacing 2px, font-size 10px; inclui "→" após o texto
- **CTA secundário:** sem fundo, sem borda, texto em `rgba(255,255,255,0.5)`, caps, letter-spacing 2px, font-size 9px, alinhado ao lado do CTA primário
- Ideal para: posts de impacto, ads, conteúdo offshore, lançamentos

### Lógica de escolha por público

| Público | Estilos prioritários |
|---|---|
| OFFSHORE | 7, 6, 1, 3 |
| CORPORATIVO | 7, 5, 2, 3 |
| VIAJANTE | 7, 1, 4, 2 |
| INFANTIL | 2, 4 (cores vivas, formas grandes) |
| GERAL | 7, 1, 2 — prioriza o mais adequado ao tema |

### Output obrigatório antes do HTML

Antes de gerar o código, declara:

```
ESTILO ESCOLHIDO: [número] — [nome]
PÚBLICO DETECTADO: [público]
MOTIVO: [1 frase explicando por que este estilo se encaixa no tema e público]
```

---

## TAREFA
Crie um componente HTML/CSS completo para o tema: **{topic}**

O componente será convertido em imagem via screenshot (puppeteer).

### Entregável: arquivo HTML completo e autocontido

**Especificações técnicas:**
- Dimensões: 1080x1080px (feed Instagram) OU 1080x1920px (Stories/Reels) — especificar qual
- Todos os estilos inline ou em `<style>` tag no mesmo arquivo
- Fontes via Google Fonts CDN
- Sem JavaScript (imagem estática)
- Sem dependências externas além de Google Fonts
- O layout deve implementar fielmente o estilo escolhido acima

### Estrutura do HTML:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* 1080x1080 ou 1080x1920 */
    body { margin: 0; width: 1080px; height: 1080px; overflow: hidden; }
    /* seus estilos aqui — baseados no estilo escolhido */
  </style>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
</head>
<body>
  <!-- conteúdo do post aqui -->
</body>
</html>
```

### Variações a criar:
1. **Versão feed (1080x1080):** layout quadrado no estilo escolhido
2. **Versão stories (1080x1920):** layout vertical adaptado do mesmo estilo

### Elementos obrigatórios em cada peça:
- Logo Schilling's (texto estilizado se não tiver arquivo: "SCHILLING'S" em azul bold + "ENGLISH COURSE" menor embaixo)
- Curvas decorativas nas bordas (SVG inline)
- Hierarquia de texto clara
- Telefone de contato: +55 21 97210-9221 (quando for peça de conversão)

### Referência visual da copy aprovada:
{copy_aprovada}

---

## REFERÊNCIA VISUAL PRINCIPAL DA MARCA

O **ESTILO 7 — HERO SCHILLINGS** é o design de referência aprovado pela marca (landing page oficial).
Todos os outros estilos devem ter o mesmo DNA: gradiente azul profundo, tipografia Barlow Condensed Bold em caps, palavra-chave em vermelho itálico, formas geométricas rotacionadas com opacity baixa, hierarquia título → subheadline → body → CTA.

### DNA visual inegociável (presente em todos os estilos)
- Paleta: `#1B3A8C` (azul) · `#E8202A` (vermelho) · `#FFFFFF` (branco)
- Tipografia: Barlow Condensed Bold para títulos + Open Sans para corpo
- Palavra ou frase de impacto em vermelho `#E8202A`, preferencialmente itálico
- Logo sempre presente: "SCH" branco + "ILLINGS" vermelho, "CURSO DE INGLÊS" abaixo
- Nunca usar fundos totalmente neutros sem pelo menos um acento vermelho

### Como usar imagem de referência externa

Se o usuário fornecer uma imagem de referência junto ao tema:
1. Analise a **composição** (onde estão os elementos, proporções, pesos visuais)
2. Analise os **efeitos** (gradientes, sobreposições, texturas, opacidades)
3. Analise a **hierarquia tipográfica** (tamanhos relativos, pesos, espaçamentos)
4. Reproduza a estrutura adaptando para a paleta e fontes Schilling's
5. Declare no output: `REFERÊNCIA EXTERNA DETECTADA — adaptando composição para identidade Schilling's`

## QUANDO HOUVER REFERÊNCIA PARA O POST
Se for fornecida uma imagem de referência específica para este post:
- Extraia a composição e hierarquia visual da referência
- Adapte para a identidade Schilling's
- Mantenha o conceito mas use as cores e tipografia da marca
