# ScapeProtocol
### Premissa:
O ScapeProtocol foi corrompido. Após um vazamento biológico catastrófico, as luzes do laboratório subterrâneo se apagaram, restando apenas sistemas de emergência e escuridão total. Não há armas, não há munição e não há como revidar. Dois cientistas sobreviventes precisam usar a escuridão, a furtividade e a coordenação mecânica para escapar de duas ameaças mutantes que dominam os corredores, ativar o terminal principal e abrir a porta de quarentena LV.3 antes que o oxigênio acabe. Tocar em qualquer criatura é morte instantânea.

# ScapeProtocol - Documento de Level Design

Documento oficial de especificação de nível e mecânicas stealth para a fase do laboratório subterrâneo.

---

## 📝 Visão Geral do Game

> **Premissa:** Após um experimento biológico falhar, o laboratório entrou em escuridão e lockdown total. Dois cientistas desarmados precisam cooperar no escuro para encontrar a Célula de Energia e abrir a porta de fuga **LV.3** antes de serem pegos pelas criaturas.

*   **Estilo de Jogo:** Stealth Cooperativo (2 Jogadores).
*   **Combate:** Inexistente. Foco total em fuga e evasão.
*   **Ambiente:** Mapa escuro com iluminação dinâmica situacional (faíscas e brilho biológico).

---

## 👾 Matriz de Ameaças (Inimigos)

| Inimigo | Velocidade | Padrão de Movimento | Comportamento de Alerta |
| :--- | :--- | :--- | :--- |
| **Rato Mutante** | Rápida | Patrulha os corredores principais em rotas semi-previsíveis. | Ouve passos rápidos (corrida) ou som de slimes esmagados. Ataca imediatamente. |
| **Slime Verde** | Lenta | Desloca-se de forma errática pelo chão. Emite luz fosforescente fraca. | Funciona como obstáculo móvel. Se o jogador tocá-lo, morre e faz barulho alto. |

---

## 🗺️ Detalhamento das Zonas (Mapa: `Screenshot 2026-06-22 at 08.48.21.png`)

### 🟥 Zona A: Ponto de Escape (Canto Superior Esquerdo)
*   **Objetivo:** Sobreviver ao início do lockdown e destravar a porta **LV.3**.
*   **Mecânica:** O terminal principal está sem energia. Requer uma *Célula de Energia* vinda da Zona C.
*   **Cooperação:** O jogador que interagir com o terminal pode acionar sobrecargas nas bobinas para criar distrações sonoras para o parceiro.

### 🟦 Zona B: O Corredor das Bobinas (Centro)
*   **Obstáculo:** Totalmente escura. As bobinas elétricas soltam faíscas rítmicas, iluminando o cenário por frações de segundo.
*   **Desafio Furtivo:** O Rato Mutante patrulha essa área. O jogador de campo deve avançar agachado, usando os flashes de luz para desviar do Rato e de dois Slimes que se movem devagar pelo centro.

### 🧪 Zona C: Laboratório de Químicos (Lado Direito)
*   **Objetivo:** Coletar a Célula de Energia nas prateleiras inferiores.
*   **Desafio Furtivo:** Os tanques estão vazando. Vários Slimes Verdes se movem aleatoriamente pelo chão, transformando a sala em um labirinto dinâmico e perigoso.

### 🟪 Zona D: Poço de Descarte (Piso Roxo - Inferior Esquerdo)
*   **Mecânica de Alívio:** Área altamente tóxica onde os monstros não entram. 
*   **Risco x Recompensa:** Pode ser usada para despistar o Rato Mutante em uma emergência, mas ficar parado no piso roxo drena a vida do cientista devido aos gases.

---

## 🕹️ Fluxo Base de Gameplay (Game Loop)

1. **Infiltração:** Jogadores começam na Zona A e analisam a escuridão da Zona B.
2. **Distração:** Jogador 1 usa o painel para estalar uma bobina; Jogador 2 passa agachado pelo Rato.
3. **Coleta:** Jogador 2 desvia dos Slimes lentos na Zona C e pega a Célula de Energia.
4. **Retorno Tênue:** Jogador 2 volta pela Zona B (onde os Slimes já mudaram de posição).
5. **Clímax:** Célula inserida, porta LV.3 abrindo faz barulho e atrai o Rato para uma perseguição final.

---

## 🛠️ Checklist de Desenvolvimento

- [ ] Implementar sistema de iluminação global zerada (Escuridão).
- [ ] Programar IA auditiva do Rato Mutante (rastreamento de som de corrida).
- [ ] Configurar movimentação errática lenta para os Slimes Verdes.
- [ ] Adicionar efeito visual de faíscas iluminando o cenário na Zona B.

<img width="911" height="395" alt="Screenshot 2026-03-06 at 15 05 44" src="https://github.com/user-attachments/assets/5ce38f8e-e694-4eb8-8d9e-5a8e6d745856" />
