#!/usr/bin/env python3
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
    
    # Determinar ponto de alerta (no meio da série)
    alert_index = int(num_points * 0.5)
    
    # Definir valor de alerta
    values[alert_index] = threshold * 1.2 if threshold else 95
    
    # Adicionar alguns valores altos próximos ao alerta para criar um padrão
    for i in range(1, 4):
        if alert_index - i >= 0:
            values[alert_index - i] = values[alert_index] * (0.9 - (i * 0.1))
    
    # Adicionar valores decrescentes após o alerta para simular resolução
    for i in range(1, 10):
        if alert_index + i < num_points:
            decay_factor = 1 - (i * 0.1)
            if decay_factor < 0.4:
                decay_factor = 0.4
            values[alert_index + i] = values[alert_index] * decay_factor
    
    # Garantir que os últimos valores estejam abaixo do threshold
    for i in range(num_points - 5, num_points):
        if i > alert_index:
            values[i] = threshold * 0.6 if threshold else 30
    
    return timestamps, values, alert_index

def create_resolution_graph(alert_name, threshold, unit, host, save_path):
    """
    Cria um gráfico simulando a resolução de um problema do Zabbix.
    """
    # Configurar estilo do gráfico para parecer com o Zabbix
    plt.style.use('dark_background')
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Gerar dados de série temporal
    timestamps, values, alert_index = generate_resolution_data(threshold=float(threshold))
    
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
    ax.set_title(f"{alert_name}: {host} - Resolvido", color='white', fontsize=14)
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
        print("Uso: python resolution_graph_generator.py <alert_name> <threshold> <unit> <host> <save_path>")
        sys.exit(1)
    
    alert_name = sys.argv[1]
    threshold = sys.argv[2]
    unit = sys.argv[3]
    host = sys.argv[4]
    save_path = sys.argv[5]
    
    graph_path = create_resolution_graph(alert_name, threshold, unit, host, save_path)
    print(graph_path)
