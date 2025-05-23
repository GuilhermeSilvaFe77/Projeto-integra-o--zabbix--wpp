# Guia de Instalação e Uso - Integração Zabbix + WhatsApp (Versão Gratuita)

Este guia explica como configurar e usar a integração entre Zabbix e WhatsApp usando a biblioteca WPPConnect, uma solução **totalmente gratuita** que não depende da API oficial paga do WhatsApp Business.

## Requisitos

- Node.js 14+ instalado
- Python 3.6+ com matplotlib e numpy
- Acesso ao WhatsApp em um dispositivo móvel para escanear o QR code
- Servidor Zabbix (ou nosso simulador para testes)

## Instalação

1. Clone o repositório ou extraia os arquivos em uma pasta de sua preferência:

```bash
git clone https://github.com/seu-usuario/zabbix-whatsapp-integration-free.git
cd zabbix-whatsapp-integration-free
```

2. Instale as dependências do Node.js:

```bash
npm install
```

3. Certifique-se de que as dependências Python estão instaladas:

```bash
pip install matplotlib numpy
```

4. Crie a pasta para armazenar os gráficos:

```bash
mkdir -p graphs
```

## Configuração

Não é necessário configurar tokens ou chaves de API, pois esta solução utiliza o WhatsApp Web diretamente!

## Executando a Aplicação

1. Inicie o servidor:

```bash
node index.js
```

2. Na primeira execução, um QR code será exibido no terminal e salvo como arquivo `qrcode.png`. Escaneie este QR code com o WhatsApp do seu celular para autenticar a sessão.

3. Após a autenticação bem-sucedida, o servidor estará pronto para receber e enviar mensagens.

## Testando a Integração

### Simulando um Alerta

Para simular um alerta do Zabbix e enviá-lo via WhatsApp:

1. Acesse a seguinte URL no navegador (substitua o número pelo seu número de WhatsApp no formato internacional, sem o +):

```
http://localhost:8000/simulate-alert?phone=5511999999999
```

2. Um alerta será enviado para o número especificado, incluindo um gráfico gerado automaticamente.

### Comandos Disponíveis no WhatsApp

Após receber um alerta, você pode interagir com o sistema enviando os seguintes comandos via WhatsApp:

- `#help` ou `#commands` - Lista todos os comandos disponíveis
- `#status` - Verifica o status atual do sistema
- `#acknowledge` - Confirma o recebimento de um alerta
- `#resolve` - Marca um alerta como resolvido
- `#history` - Mostra os últimos 5 alertas

## Integração com Zabbix Real

Para integrar com um servidor Zabbix real, configure um script de alerta no Zabbix para enviar requisições HTTP POST para:

```
http://seu-servidor:8000/zabbix-alert
```

Com o seguinte payload JSON:

```json
{
  "phone": "5511999999999",
  "subject": "Problema: {TRIGGER.NAME}",
  "message": "🚨 *ALERTA: {TRIGGER.NAME}*\n\n*Host:* {HOST.NAME}\n*Problema:* {TRIGGER.NAME}\n*Severidade:* {TRIGGER.SEVERITY}\n*Horário:* {EVENT.DATE} {EVENT.TIME}"
}
```

## Vantagens desta Solução Gratuita

- **Sem custos**: Não utiliza a API oficial paga do WhatsApp Business
- **Fácil configuração**: Não precisa de aprovação da Meta ou processo de verificação
- **Funcionalidades completas**: Envio de mensagens, imagens e interatividade via comandos
- **Código aberto**: Totalmente personalizável para suas necessidades

## Solução de Problemas

- Se o QR code expirar, reinicie o servidor para gerar um novo
- Certifique-se de que o WhatsApp no celular está conectado à internet
- Verifique se o número de telefone está no formato correto (com código do país, sem o +)

## Limitações

- Requer que o servidor esteja sempre online para manter a sessão do WhatsApp Web
- Pode ser necessário reautenticar periodicamente escaneando um novo QR code
- Não é recomendado para uso em produção com volume muito alto de mensagens

---

Desenvolvido por: Analista de Suporte N1 Guilherme Ferreira - Mercadocar Mercantil de Peças
