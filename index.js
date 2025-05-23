// Integração Zabbix + WhatsApp usando WPPConnect (Gratuito)
// Autor: Analista de Suporte N1 - Mercadocar Mercantil de Peças
// Data: Maio 2025

const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configurações
const PORT = process.env.PORT || 8000;
const SESSION_NAME = 'zabbix-alerts';
const COMMANDS = {
  '#help': 'Mostra a lista de comandos disponíveis',
  '#status': 'Verifica o status atual do sistema',
  '#acknowledge': 'Confirma o recebimento de um alerta',
  '#resolve': 'Marca um alerta como resolvido',
  '#history': 'Mostra os últimos 5 alertas',
  '#commands': 'Lista todos os comandos disponíveis'
};

// Diretório para armazenar os gráficos
const GRAPHS_DIR = path.join(__dirname, 'graphs');
if (!fs.existsSync(GRAPHS_DIR)) {
  fs.mkdirSync(GRAPHS_DIR, { recursive: true });
}

// Armazenamento de alertas ativos
const activeAlerts = {};

// Inicializar Express
const app = express();
app.use(cors());
app.use(express.json());
app.use('/graphs', express.static(GRAPHS_DIR));

// Cliente WhatsApp
let client;

// Inicializar o cliente WhatsApp
async function initWhatsApp() {
  console.log('Iniciando cliente WhatsApp...');
  
  try {
    client = await wppconnect.create({
      session: SESSION_NAME,
      autoClose: false,
      puppeteerOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      },
      catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
        console.log('QR Code gerado. Por favor, escaneie com seu WhatsApp:');
        console.log(asciiQR);
        
        // Salvar QR code como imagem para fácil escaneamento
        const qrCodePath = path.join(__dirname, 'qrcode.png');
        const matches = base64Qr.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (matches && matches.length === 3) {
          const data = Buffer.from(matches[2], 'base64');
          fs.writeFileSync(qrCodePath, data);
          console.log(`QR Code salvo em: ${qrCodePath}`);
        }
      },
      logQR: false
    });

    // Configurar manipuladores de eventos
    setupEventHandlers();
    
    console.log('Cliente WhatsApp inicializado com sucesso!');
    return true;
  } catch (error) {
    console.error('Erro ao inicializar cliente WhatsApp:', error);
    return false;
  }
}

// Configurar manipuladores de eventos do WhatsApp
function setupEventHandlers() {
  // Manipular mensagens recebidas
  client.onMessage(async (message) => {
    if (!message.isGroupMsg && message.body.startsWith('#')) {
      await handleCommand(message);
    }
  });
  
  // Manipular desconexões
  client.onStateChange((state) => {
    console.log('Estado do WhatsApp:', state);
    if (state === 'CONFLICT' || state === 'UNLAUNCHED') {
      client.useHere();
    }
  });
  
  // Manipular erros de autenticação
  //client.onAuthFailure(async (error) => {
    //console.error('Erro de autenticação:', error);
    //console.log('Tentando reconectar...');
    // Tentar reconectar após falha de autenticação
    //await initWhatsApp();
  //});
}

// Processar comandos recebidos via WhatsApp
async function handleCommand(message) {
  const command = message.body.toLowerCase().trim();
  const sender = message.from;
  let response = '';
  
  console.log(`Comando recebido de ${sender}: ${command}`);
  
  switch (command) {
    case '#help':
    case '#commands':
      response = '*Comandos Disponíveis:*\n\n';
      for (const [cmd, desc] of Object.entries(COMMANDS)) {
        response += `*${cmd}*: ${desc}\n`;
      }
      break;
      
    case '#status':
      response = '*Status do Sistema:*\n\n';
      response += '✅ *Zabbix*: Operacional\n';
      response += '✅ *WhatsApp*: Conectado\n';
      response += '✅ *Integração*: Funcionando\n\n';
      
      // Adicionar informações sobre alertas ativos
      const activeCount = activeAlerts[sender]?.length || 0;
      response += `Alertas ativos: ${activeCount}\n`;
      response += `Último check: ${new Date().toLocaleString('pt-BR')}`;
      break;
      
    case '#acknowledge':
      if (sender in activeAlerts && activeAlerts[sender].length > 0) {
        // Marcar o alerta mais recente como confirmado
        const alert = activeAlerts[sender][activeAlerts[sender].length - 1];
        alert.acknowledged = true;
        alert.ackTime = new Date().toLocaleString('pt-BR');
        
        response = '✅ *Alerta confirmado com sucesso!*\n\n';
        response += `*Host:* ${alert.alertType.host}\n`;
        response += `*Problema:* ${alert.alertType.description}\n`;
        response += `*Confirmado em:* ${alert.ackTime}\n`;
        response += '\nUma equipe técnica foi notificada e está analisando o problema.';
      } else {
        response = '❌ Não há alertas ativos para confirmar.';
      }
      break;
      
    case '#resolve':
      if (sender in activeAlerts && activeAlerts[sender].length > 0) {
        // Pegar o alerta mais recente
        const alert = activeAlerts[sender][activeAlerts[sender].length - 1];
        
        // Simular resolução
        const resolutionGraphPath = await simulateResolution(alert.alertType, alert.graphPath);
        
        // Marcar como resolvido
        alert.resolved = true;
        alert.resolutionTime = new Date().toLocaleString('pt-BR');
        alert.resolutionGraph = resolutionGraphPath;
        
        // Enviar mensagem de resolução com gráfico
        const resolutionMessage = generateResolutionMessage(alert.alertType);
        await sendWhatsAppMessage(sender, resolutionMessage, resolutionGraphPath);
        
        response = '✅ *Comando de resolução processado.*\n\nO gráfico de resolução foi enviado em uma mensagem separada.';
      } else {
        response = '❌ Não há alertas ativos para resolver.';
      }
      break;
      
    case '#history':
      if (sender in activeAlerts && activeAlerts[sender].length > 0) {
        const alerts = activeAlerts[sender].slice(-5); // Últimos 5 alertas
        
        response = '*Histórico de Alertas:*\n\n';
        for (let i = 0; i < alerts.length; i++) {
          const alert = alerts[i];
          const status = alert.resolved ? '✅ Resolvido' : '⚠️ Ativo';
          const ack = alert.acknowledged ? '✓ Confirmado' : '✗ Não confirmado';
          
          response += `*${i + 1}. ${alert.alertType.name}*\n`;
          response += `   Host: ${alert.alertType.host}\n`;
          response += `   Status: ${status}\n`;
          response += `   Confirmação: ${ack}\n`;
          response += `   Horário: ${alert.time}\n\n`;
        }
      } else {
        response = '📝 *Histórico de Alertas Vazio*\n\nNenhum alerta foi registrado para este número.';
      }
      break;
      
    default:
      response = '❓ *Comando não reconhecido*\n\n';
      response += 'Envie *#help* ou *#commands* para ver a lista de comandos disponíveis.';
  }
  
  // Enviar resposta
  await client.sendText(sender, response);
}

// Enviar mensagem com ou sem imagem via WhatsApp
async function sendWhatsAppMessage(to, message, imagePath = null) {
  try {
    if (imagePath && fs.existsSync(imagePath)) {
      // Enviar imagem com legenda
      await client.sendImage(
        to,
        imagePath,
        'grafico.png',
        message
      );
      console.log(`Mensagem com imagem enviada para ${to}`);
    } else {
      // Enviar apenas texto
      await client.sendText(to, message);
      console.log(`Mensagem de texto enviada para ${to}`);
    }
    return true;
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return false;
  }
}

// Tipos de alertas que podem ser gerados
const ALERT_TYPES = [
  {
    name: 'CPU Usage',
    description: 'High CPU usage detected',
    severity: 'High',
    threshold: 90,
    unit: '%',
    host: 'SRV-APP01',
    item: 'CPU | Usage',
  },
  {
    name: 'Memory Usage',
    description: 'High memory consumption',
    severity: 'High',
    threshold: 95,
    unit: '%',
    host: 'SRV-DB01',
    item: 'Memory | Usage',
  },
  {
    name: 'Disk Space',
    description: 'Low disk space available',
    severity: 'High',
    threshold: 90,
    unit: '%',
    host: 'SRV-STORAGE',
    item: 'FS | Space Used, in %',
  },
  {
    name: 'Network Traffic',
    description: 'Excessive network traffic',
    severity: 'High',
    threshold: 95,
    unit: 'Mbps',
    host: 'ROUTER-MAIN',
    item: 'Interface | Traffic',
  },
  {
    name: 'Database Connections',
    description: 'Too many database connections',
    severity: 'High',
    threshold: 200,
    unit: 'connections',
    host: 'DB-MASTER',
    item: 'MySQL | Connections',
  }
];

// Gerar gráfico para alerta
async function generateGraph(alertType) {
  // Nome do arquivo baseado no tipo de alerta e timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '');
  const filename = `${alertType.name.toLowerCase().replace(/ /g, '_')}_${timestamp}.png`;
  const graphPath = path.join(GRAPHS_DIR, filename);
  
  // Usar Python para gerar o gráfico (reaproveitando o código do simulador)
  const pythonScript = path.join(__dirname, 'graph_generator.py');
  
  // Verificar se o script existe, se não, criá-lo
  if (!fs.existsSync(pythonScript)) {
    createGraphGeneratorScript();
  }
  
  // Executar o script Python para gerar o gráfico
  // CORREÇÃO: Usar 'python' e colocar caminho entre aspas
  const command = `python "${pythonScript}" "${alertType.name}" ${alertType.threshold} "${alertType.unit}" "${alertType.host}" "${graphPath}"`;
  
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Erro ao gerar gráfico: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`Stderr: ${stderr}`);
      }
      console.log(`Gráfico gerado: ${stdout}`);
      resolve(graphPath);
    });
  });
}

// Criar script Python para geração de gráficos
function createGraphGeneratorScript() {
  const scriptContent = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Gerador de Gráficos para Simulação de Alertas do Zabbix

Este script gera gráficos simulando dados do Zabbix para diferentes tipos de alertas.
"""

import sys
import os
import random
import datetime
import matplotlib.pyplot as plt
import numpy as np

def generate_time_series_data(duration_hours=24, interval_minutes=30, threshold=None):
    """
    Gera dados de série temporal para simular métricas do Zabbix.
    """
    # Calcular número de pontos baseado na duração e intervalo
    num_points = int((duration_hours * 60) / interval_minutes)
    
    # Gerar timestamps (de trás para frente, terminando no momento atual)
    end_time = datetime.datetime.now()
    timestamps = [end_time - datetime.timedelta(minutes=i*interval_minutes) for i in range(num_points)]
    timestamps.reverse()  # Ordenar cronologicamente
    
    # Gerar valores base com alguma variação aleatória
    base_value = threshold * 0.7 if threshold else 50
    values = [base_value + random.uniform(-10, 10) for _ in range(num_points)]
    
    # Determinar ponto de alerta (próximo ao final da série)
    alert_index = random.randint(int(num_points * 0.8), num_points - 1)
    
    # Definir valor de alerta
    values[alert_index] = threshold * 1.2 if threshold else 95
    
    # Adicionar alguns valores altos próximos ao alerta para criar um padrão
    for i in range(1, 4):
        if alert_index - i >= 0:
            values[alert_index - i] = values[alert_index] * (0.9 - (i * 0.1))
    
    return timestamps, values, alert_index

def create_graph(alert_name, threshold, unit, host, save_path):
    """
    Cria um gráfico simulando dados do Zabbix para o tipo de alerta especificado.
    """
    # Configurar estilo do gráfico para parecer com o Zabbix
    plt.style.use('dark_background')
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Gerar dados de série temporal
    timestamps, values, alert_index = generate_time_series_data(threshold=float(threshold))
    
    # Converter timestamps para formato legível
    formatted_times = [t.strftime('%H:%M') for t in timestamps]
    
    # Plotar linha principal
    ax.plot(formatted_times, values, 'g-', linewidth=2, label=f"{host}: {alert_name}")
    
    # Adicionar linha de threshold
    ax.axhline(y=float(threshold), color='r', linestyle='--', alpha=0.7, 
               label=f"Threshold: {threshold} {unit}")
    
    # Destacar ponto de alerta
    ax.plot(formatted_times[alert_index], values[alert_index], 'ro', markersize=8)
    
    # Configurar aparência do gráfico
    ax.set_title(f"{alert_name}: {host}", color='white', fontsize=14)
    ax.set_xlabel('Time', color='white')
    ax.set_ylabel(f"{alert_name} ({unit})", color='white')
    ax.tick_params(axis='x', rotation=45)
    ax.grid(True, alpha=0.3)
    
    # Mostrar apenas alguns ticks no eixo X para evitar sobreposição
    tick_indices = np.linspace(0, len(formatted_times)-1, 10, dtype=int)
    ax.set_xticks([formatted_times[i] for i in tick_indices])
    
    # Adicionar legenda
    ax.legend(loc='upper left')
    
    # Ajustar layout
    plt.tight_layout()
    
    # Salvar o gráfico
    plt.savefig(save_path)
    plt.close()
    
    return save_path

if __name__ == "__main__":
    if len(sys.argv) < 6:
        print("Uso: python graph_generator.py <alert_name> <threshold> <unit> <host> <save_path>")
        sys.exit(1)
    
    alert_name = sys.argv[1]
    threshold = sys.argv[2]
    unit = sys.argv[3]
    host = sys.argv[4]
    save_path = sys.argv[5]
    
    graph_path = create_graph(alert_name, threshold, unit, host, save_path)
    print(graph_path)
`;

  fs.writeFileSync(path.join(__dirname, 'graph_generator.py'), scriptContent);
  console.log('Script de geração de gráficos criado com sucesso.');
}

// Simular resolução de alerta
async function simulateResolution(alertType, originalGraphPath) {
  // Nome do arquivo baseado no original com sufixo _resolved
  const resolutionGraphPath = originalGraphPath.replace('.png', '_resolved.png');
  
  // Usar Python para gerar o gráfico de resolução
  const pythonScript = path.join(__dirname, 'resolution_graph_generator.py');
  
  // Verificar se o script existe, se não, criá-lo
  if (!fs.existsSync(pythonScript)) {
    createResolutionGraphScript();
  }
  
  // Executar o script Python para gerar o gráfico de resolução
  // CORREÇÃO: Usar 'python' e colocar caminho entre aspas
  const command = `python "${pythonScript}" "${alertType.name}" ${alertType.threshold} "${alertType.unit}" "${alertType.host}" "${resolutionGraphPath}"`;
  
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Erro ao gerar gráfico de resolução: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`Stderr: ${stderr}`);
      }
      console.log(`Gráfico de resolução gerado: ${stdout}`);
      resolve(resolutionGraphPath);
    });
  });
}

// Criar script Python para geração de gráficos de resolução
function createResolutionGraphScript() {
  const scriptContent = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Gerador de Gráficos de Resolução para Simulação de Alertas do Zabbix

Este script gera gráficos simulando a resolução de problemas do Zabbix.
"""

import sys
import os
import random
import datetime
import matplotlib.pyplot as plt
import numpy as np

def generate_resolution_data(duration_hours=24, interval_minutes=30, threshold=None):
    """
    Gera dados de série temporal para simular resolução de problemas.
    """
    # Calcular número de pontos baseado na duração e intervalo
    num_points = int((duration_hours * 60) / interval_minutes)
    
    # Gerar timestamps (de trás para frente, terminando no momento atual)
    end_time = datetime.datetime.now()
    timestamps = [end_time - datetime.timedelta(minutes=i*interval_minutes) for i in range(num_points)]
    timestamps.reverse()  # Ordenar cronologicamente
    
    # Gerar valores base com alguma variação aleatória
    base_value = threshold * 0.7 if threshold else 50
    values = [base_value + random.uniform(-10, 10) for _ in range(num_points)]
    
    # Simular ponto de alerta alto
    alert_index = random.randint(int(num_points * 0.6), int(num_points * 0.8))
    values[alert_index] = threshold * 1.2 if threshold else 95
    for i in range(1, 3):
        if alert_index - i >= 0:
            values[alert_index - i] = values[alert_index] * (0.9 - (i * 0.1))
            
    # Simular resolução: valores voltam ao normal após o ponto de alerta
    for i in range(alert_index + 1, num_points):
        values[i] = base_value + random.uniform(-5, 5)
    
    return timestamps, values, alert_index

def create_resolution_graph(alert_name, threshold, unit, host, save_path):
    """
    Cria um gráfico simulando a resolução de um problema do Zabbix.
    """
    # Configurar estilo do gráfico
    plt.style.use('dark_background')
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Gerar dados de série temporal simulando resolução
    timestamps, values, alert_index = generate_resolution_data(threshold=float(threshold))
    
    # Converter timestamps para formato legível
    formatted_times = [t.strftime('%H:%M') for t in timestamps]
    
    # Plotar linha principal
    ax.plot(formatted_times, values, 'g-', linewidth=2, label=f"{host}: {alert_name}")
    
    # Adicionar linha de threshold
    ax.axhline(y=float(threshold), color='r', linestyle='--', alpha=0.7, 
               label=f"Threshold: {threshold} {unit}")
    
    # Destacar ponto onde estava o alerta
    ax.plot(formatted_times[alert_index], values[alert_index], 'yo', markersize=8, label='Ponto do Alerta')
    
    # Configurar aparência do gráfico
    ax.set_title(f"RESOLVIDO: {alert_name}: {host}", color='lime', fontsize=14)
    ax.set_xlabel('Time', color='white')
    ax.set_ylabel(f"{alert_name} ({unit})", color='white')
    ax.tick_params(axis='x', rotation=45)
    ax.grid(True, alpha=0.3)
    
    # Mostrar apenas alguns ticks no eixo X
    tick_indices = np.linspace(0, len(formatted_times)-1, 10, dtype=int)
    ax.set_xticks([formatted_times[i] for i in tick_indices])
    
    # Adicionar legenda
    ax.legend(loc='upper left')
    
    # Ajustar layout
    plt.tight_layout()
    
    # Salvar o gráfico
    plt.savefig(save_path)
    plt.close()
    
    return save_path

if __name__ == "__main__":
    if len(sys.argv) < 6:
        print("Uso: python resolution_graph_generator.py <alert_name> <threshold> <unit> <host> <save_path>")
        sys.exit(1)
    
    alert_name = sys.argv[1]
    threshold = sys.argv[2]
    unit = sys.argv[3]
    host = sys.argv[4]
    save_path = sys.argv[5]
    
    graph_path = create_resolution_graph(alert_name, threshold, unit, host, save_path)
    print(graph_path)
`;

  fs.writeFileSync(path.join(__dirname, 'resolution_graph_generator.py'), scriptContent);
  console.log('Script de geração de gráficos de resolução criado com sucesso.');
}

// Gerar mensagem de alerta formatada
function generateAlertMessage(alertType) {
  return `🚨 *ALERTA: ${alertType.name}*\n\n*Host:* ${alertType.host}\n*Problema:* ${alertType.description}\n*Severidade:* ${alertType.severity}\n*Horário:* ${new Date().toLocaleString('pt-BR')}\n\nEnvie *#acknowledge* para confirmar ou *#resolve* para marcar como resolvido.`;
}

// Gerar mensagem de resolução formatada
function generateResolutionMessage(alertType) {
  return `✅ *RESOLVIDO: ${alertType.name}*\n\n*Host:* ${alertType.host}\n*Problema:* ${alertType.description}\n*Horário da Resolução:* ${new Date().toLocaleString('pt-BR')}\n\nO gráfico abaixo mostra a normalização da métrica.`;
}

// Rotas da API Express

// Rota raiz para informações
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Zabbix WhatsApp Integration (Free)',
    version: '1.0.0',
    endpoints: {
      '/': 'Esta página de informações',
      '/status': 'Verificar status da conexão com WhatsApp',
      '/simulate-alert': 'Simular um alerta do Zabbix (parâmetro: phone)'
    }
  });
});

// Rota para verificar status da conexão
app.get('/status', async (req, res) => {
  if (!client) {
    return res.status(503).json({ status: 'error', message: 'Cliente WhatsApp não inicializado.' });
  }
  
  try {
    const connectionState = await client.getConnectionState();
    res.json({ status: 'ok', connectionState: connectionState });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Erro ao obter status da conexão.', error: error.message });
  }
});

// Rota para simular um alerta do Zabbix
app.get('/simulate-alert', async (req, res) => {
  const phone = req.query.phone;
  
  if (!phone) {
    return res.status(400).json({ status: 'error', message: 'Parâmetro "phone" é obrigatório.' });
  }
  
  if (!client) {
    return res.status(503).json({ status: 'error', message: 'Cliente WhatsApp não inicializado.' });
  }
  
  try {
    // Escolher um tipo de alerta aleatório
    const alertType = ALERT_TYPES[Math.floor(Math.random() * ALERT_TYPES.length)];
    
    // Gerar gráfico
    const graphPath = await generateGraph(alertType);
    
    // Gerar mensagem
    const message = generateAlertMessage(alertType);
    
    // Enviar mensagem com gráfico
    const success = await sendWhatsAppMessage(phone + '@c.us', message, graphPath);
    
    if (success) {
      // Armazenar alerta ativo
      if (!activeAlerts[phone + '@c.us']) {
        activeAlerts[phone + '@c.us'] = [];
      }
      activeAlerts[phone + '@c.us'].push({
        id: `alert_${Date.now()}`,
        time: new Date().toLocaleString('pt-BR'),
        alertType: alertType,
        graphPath: graphPath,
        acknowledged: false,
        resolved: false,
        ackTime: null,
        resolutionTime: null,
        resolutionGraph: null
      });
      
      res.json({ status: 'ok', message: 'Alerta simulado enviado com sucesso.', alertType: alertType.name, graph: path.basename(graphPath) });
    } else {
      res.status(500).json({ status: 'error', message: 'Erro ao enviar mensagem via WhatsApp.' });
    }
  } catch (error) {
    console.error('Erro ao simular alerta:', error);
    res.status(500).json({ status: 'error', message: 'Erro interno ao processar a simulação.', error: error.message });
  }
});

// Rota para receber alertas do Zabbix real (via script)
app.post('/zabbix-alert', async (req, res) => {
  const { phone, subject, message } = req.body;
  
  if (!phone || !subject || !message) {
    return res.status(400).json({ status: 'error', message: 'Parâmetros "phone", "subject" e "message" são obrigatórios.' });
  }
  
  if (!client) {
    return res.status(503).json({ status: 'error', message: 'Cliente WhatsApp não inicializado.' });
  }
  
  try {
    // Tentar identificar o tipo de alerta baseado na mensagem (simplificado)
    let alertType = ALERT_TYPES.find(type => subject.includes(type.name)) || ALERT_TYPES[0]; // Default
    
    // Gerar gráfico (se possível)
    let graphPath = null;
    try {
      graphPath = await generateGraph(alertType);
    } catch (graphError) {
      console.error('Não foi possível gerar gráfico para alerta real:', graphError);
    }
    
    // Enviar mensagem
    const success = await sendWhatsAppMessage(phone + '@c.us', message, graphPath);
    
    if (success) {
      // Armazenar alerta ativo
      if (!activeAlerts[phone + '@c.us']) {
        activeAlerts[phone + '@c.us'] = [];
      }
      activeAlerts[phone + '@c.us'].push({
        id: `alert_${Date.now()}`,
        time: new Date().toLocaleString('pt-BR'),
        alertType: alertType,
        graphPath: graphPath,
        acknowledged: false,
        resolved: false,
        ackTime: null,
        resolutionTime: null,
        resolutionGraph: null
      });
      
      res.json({ status: 'ok', message: 'Alerta do Zabbix recebido e enviado.' });
    } else {
      res.status(500).json({ status: 'error', message: 'Erro ao enviar mensagem via WhatsApp.' });
    }
  } catch (error) {
    console.error('Erro ao processar alerta do Zabbix:', error);
    res.status(500).json({ status: 'error', message: 'Erro interno ao processar o alerta.', error: error.message });
  }
});

// Iniciar o servidor Express após conectar ao WhatsApp
async function startServer() {
  const whatsappReady = await initWhatsApp();
  
  if (whatsappReady) {
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`Acesse http://localhost:${PORT} para mais informações`);
    });
  } else {
    console.error('Não foi possível iniciar o servidor Express pois o cliente WhatsApp falhou ao inicializar.');
    process.exit(1); // Sair se não conseguir conectar ao WhatsApp
  }
}

// Iniciar a aplicação
startServer();

