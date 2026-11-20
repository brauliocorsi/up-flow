export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alvos: {
        Row: {
          ativo: boolean
          id: string
          nome: string
          setor_id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          id?: string
          nome: string
          setor_id: string
          tipo: string
        }
        Update: {
          ativo?: boolean
          id?: string
          nome?: string
          setor_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "alvos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          ativo: boolean
          cadencia: string
          cor: string | null
          created_at: string
          descricao: string
          duracao_padrao_min: number
          funcao_id: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cadencia?: string
          cor?: string | null
          created_at?: string
          descricao?: string
          duracao_padrao_min?: number
          funcao_id: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cadencia?: string
          cor?: string | null
          created_at?: string
          descricao?: string
          duracao_padrao_min?: number
          funcao_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_execucoes: {
        Row: {
          alvo_id: string | null
          concluida_em: string | null
          concluida_por: string | null
          criado_em: string
          data_referencia: string
          estado: string
          id: string
          iniciada_em: string | null
          template_id: string
        }
        Insert: {
          alvo_id?: string | null
          concluida_em?: string | null
          concluida_por?: string | null
          criado_em?: string
          data_referencia: string
          estado?: string
          id?: string
          iniciada_em?: string | null
          template_id: string
        }
        Update: {
          alvo_id?: string | null
          concluida_em?: string | null
          concluida_por?: string | null
          criado_em?: string
          data_referencia?: string
          estado?: string
          id?: string
          iniciada_em?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_execucoes_alvo_id_fkey"
            columns: ["alvo_id"]
            isOneToOne: false
            referencedRelation: "alvos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execucoes_concluida_por_fkey"
            columns: ["concluida_por"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execucoes_concluida_por_fkey"
            columns: ["concluida_por"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "checklist_execucoes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_execucoes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "vw_cumprimento_checklists"
            referencedColumns: ["template_id"]
          },
        ]
      }
      checklist_itens: {
        Row: {
          exige_foto_se_nok: boolean
          id: string
          instrucao: string | null
          instrucao_media: string[]
          obrigatorio: boolean
          ordem: number
          setor_reporte_id: string | null
          template_id: string
          texto: string
          tipo: string
        }
        Insert: {
          exige_foto_se_nok?: boolean
          id?: string
          instrucao?: string | null
          instrucao_media?: string[]
          obrigatorio?: boolean
          ordem: number
          setor_reporte_id?: string | null
          template_id: string
          texto: string
          tipo?: string
        }
        Update: {
          exige_foto_se_nok?: boolean
          id?: string
          instrucao?: string | null
          instrucao_media?: string[]
          obrigatorio?: boolean
          ordem?: number
          setor_reporte_id?: string | null
          template_id?: string
          texto?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_itens_setor_reporte_id_fkey"
            columns: ["setor_reporte_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_itens_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_itens_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "vw_cumprimento_checklists"
            referencedColumns: ["template_id"]
          },
        ]
      }
      checklist_respostas: {
        Row: {
          execucao_id: string
          foto_url: string | null
          id: string
          item_id: string
          observacao: string | null
          reporte_id: string | null
          respondido_em: string
          respondido_por: string
          valor: string
        }
        Insert: {
          execucao_id: string
          foto_url?: string | null
          id?: string
          item_id: string
          observacao?: string | null
          reporte_id?: string | null
          respondido_em?: string
          respondido_por: string
          valor: string
        }
        Update: {
          execucao_id?: string
          foto_url?: string | null
          id?: string
          item_id?: string
          observacao?: string | null
          reporte_id?: string | null
          respondido_em?: string
          respondido_por?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_respostas_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "checklist_execucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_respostas_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "vw_cumprimento_checklists"
            referencedColumns: ["execucao_id"]
          },
          {
            foreignKeyName: "checklist_respostas_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_respostas_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_respostas_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "vw_reportes_painel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_respostas_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_respostas_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          alvo_tipo: string | null
          ativo: boolean
          criado_em: string
          descricao: string | null
          dia_mes: number | null
          dias_semana: number[]
          hora_limite: string
          id: string
          nome: string
          periodicidade: string
          setor_id: string
        }
        Insert: {
          alvo_tipo?: string | null
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          dia_mes?: number | null
          dias_semana?: number[]
          hora_limite?: string
          id?: string
          nome: string
          periodicidade: string
          setor_id: string
        }
        Update: {
          alvo_tipo?: string | null
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          dia_mes?: number | null
          dias_semana?: number[]
          hora_limite?: string
          id?: string
          nome?: string
          periodicidade?: string
          setor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      escalonamentos: {
        Row: {
          criado_em: string
          id: string
          reporte_id: string
          tipo: string
        }
        Insert: {
          criado_em?: string
          id?: string
          reporte_id: string
          tipo: string
        }
        Update: {
          criado_em?: string
          id?: string
          reporte_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalonamentos_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalonamentos_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "vw_reportes_painel"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_execucoes: {
        Row: {
          created_at: string
          evento_id: string
          fim: string | null
          id: string
          inicio: string
          motivo: string | null
        }
        Insert: {
          created_at?: string
          evento_id: string
          fim?: string | null
          id?: string
          inicio?: string
          motivo?: string | null
        }
        Update: {
          created_at?: string
          evento_id?: string
          fim?: string | null
          id?: string
          inicio?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evento_execucoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          created_at: string
          criado_por: string
          descricao: string
          estado: string
          fim: string | null
          funcionario_id: string
          id: string
          iniciado_em: string | null
          inicio: string
          lido: boolean
          ordem_fila: number
          prioridade: string
          tarefa_pausada_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          descricao?: string
          estado?: string
          fim?: string | null
          funcionario_id: string
          id?: string
          iniciado_em?: string | null
          inicio?: string
          lido?: boolean
          ordem_fila?: number
          prioridade?: string
          tarefa_pausada_id?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          descricao?: string
          estado?: string
          fim?: string | null
          funcionario_id?: string
          id?: string
          iniciado_em?: string | null
          inicio?: string
          lido?: boolean
          ordem_fila?: number
          prioridade?: string
          tarefa_pausada_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "eventos_tarefa_pausada_id_fkey"
            columns: ["tarefa_pausada_id"]
            isOneToOne: false
            referencedRelation: "tarefas_dia"
            referencedColumns: ["id"]
          },
        ]
      }
      execucoes: {
        Row: {
          created_at: string
          fim: string | null
          id: string
          inicio: string
          motivo_pausa_id: string | null
          tarefa_dia_id: string
        }
        Insert: {
          created_at?: string
          fim?: string | null
          id?: string
          inicio?: string
          motivo_pausa_id?: string | null
          tarefa_dia_id: string
        }
        Update: {
          created_at?: string
          fim?: string | null
          id?: string
          inicio?: string
          motivo_pausa_id?: string | null
          tarefa_dia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execucoes_motivo_pausa_id_fkey"
            columns: ["motivo_pausa_id"]
            isOneToOne: false
            referencedRelation: "motivos_pausa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucoes_tarefa_dia_id_fkey"
            columns: ["tarefa_dia_id"]
            isOneToOne: false
            referencedRelation: "tarefas_dia"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          data: string
          descricao: string
        }
        Insert: {
          data: string
          descricao: string
        }
        Update: {
          data?: string
          descricao?: string
        }
        Relationships: []
      }
      funcionario_setores: {
        Row: {
          created_at: string
          funcao_id: string
          funcionario_id: string
          id: string
          responsavel: boolean
        }
        Insert: {
          created_at?: string
          funcao_id: string
          funcionario_id: string
          id?: string
          responsavel?: boolean
        }
        Update: {
          created_at?: string
          funcao_id?: string
          funcionario_id?: string
          id?: string
          responsavel?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "funcionario_setores_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_setores_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_setores_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          funcao_id: string | null
          id: string
          nome: string
          papel: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          funcao_id?: string | null
          id?: string
          nome: string
          papel: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          funcao_id?: string | null
          id?: string
          nome?: string
          papel?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      funcoes: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          id: string
          nome: string
          prefixo: string | null
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          prefixo?: string | null
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          prefixo?: string | null
        }
        Relationships: []
      }
      horarios_trabalho: {
        Row: {
          ativo: boolean
          created_at: string
          funcionario_id: string
          hora_fim: string
          hora_inicio: string
          id: string
          tipo_dia: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          funcionario_id: string
          hora_fim: string
          hora_inicio: string
          id?: string
          tipo_dia: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          funcionario_id?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          tipo_dia?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_trabalho_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_trabalho_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
        ]
      }
      macros: {
        Row: {
          atividade_id: string | null
          ativo: boolean
          conteudo: string
          created_at: string
          created_by: string | null
          funcao_id: string | null
          id: string
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          atividade_id?: string | null
          ativo?: boolean
          conteudo?: string
          created_at?: string
          created_by?: string | null
          funcao_id?: string | null
          id?: string
          ordem?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          atividade_id?: string | null
          ativo?: boolean
          conteudo?: string
          created_at?: string
          created_by?: string | null
          funcao_id?: string | null
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "macros_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "macros_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      motivos_pausa: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          label: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          label: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      pausas_fixas: {
        Row: {
          ativo: boolean
          created_at: string
          funcionario_id: string
          hora_fim: string
          hora_inicio: string
          id: string
          nome: string
          ordem: number
          tipo_dia: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          funcionario_id: string
          hora_fim: string
          hora_inicio: string
          id?: string
          nome: string
          ordem?: number
          tipo_dia: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          funcionario_id?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          nome?: string
          ordem?: number
          tipo_dia?: string
        }
        Relationships: [
          {
            foreignKeyName: "pausas_fixas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pausas_fixas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
        ]
      }
      questao_mensagens: {
        Row: {
          autor_funcionario_id: string
          autor_papel: string
          created_at: string
          id: string
          lida_pelo_gestor: boolean
          lida_pelo_operador: boolean
          questao_id: string
          texto: string
        }
        Insert: {
          autor_funcionario_id: string
          autor_papel: string
          created_at?: string
          id?: string
          lida_pelo_gestor?: boolean
          lida_pelo_operador?: boolean
          questao_id: string
          texto: string
        }
        Update: {
          autor_funcionario_id?: string
          autor_papel?: string
          created_at?: string
          id?: string
          lida_pelo_gestor?: boolean
          lida_pelo_operador?: boolean
          questao_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "questao_mensagens_autor_funcionario_id_fkey"
            columns: ["autor_funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questao_mensagens_autor_funcionario_id_fkey"
            columns: ["autor_funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "questao_mensagens_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      questoes: {
        Row: {
          assunto: string
          atividade_id: string | null
          created_at: string
          estado: string
          funcionario_id: string
          id: string
          tarefa_dia_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          assunto: string
          atividade_id?: string | null
          created_at?: string
          estado?: string
          funcionario_id: string
          id?: string
          tarefa_dia_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          atividade_id?: string | null
          created_at?: string
          estado?: string
          funcionario_id?: string
          id?: string
          tarefa_dia_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questoes_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "questoes_tarefa_dia_id_fkey"
            columns: ["tarefa_dia_id"]
            isOneToOne: false
            referencedRelation: "tarefas_dia"
            referencedColumns: ["id"]
          },
        ]
      }
      rc_config: {
        Row: {
          chave: string
          valor: string
        }
        Insert: {
          chave: string
          valor: string
        }
        Update: {
          chave?: string
          valor?: string
        }
        Relationships: []
      }
      reporte_contadores: {
        Row: {
          ano: number
          setor_id: string
          ultimo: number
        }
        Insert: {
          ano: number
          setor_id: string
          ultimo?: number
        }
        Update: {
          ano?: number
          setor_id?: string
          ultimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "reporte_contadores_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      reporte_envolvidos: {
        Row: {
          ativo: boolean
          funcionario_id: string
          id: string
          marcado_em: string
          marcado_por: string
          reporte_id: string
        }
        Insert: {
          ativo?: boolean
          funcionario_id: string
          id?: string
          marcado_em?: string
          marcado_por: string
          reporte_id: string
        }
        Update: {
          ativo?: boolean
          funcionario_id?: string
          id?: string
          marcado_em?: string
          marcado_por?: string
          reporte_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reporte_envolvidos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporte_envolvidos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "reporte_envolvidos_marcado_por_fkey"
            columns: ["marcado_por"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporte_envolvidos_marcado_por_fkey"
            columns: ["marcado_por"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "reporte_envolvidos_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporte_envolvidos_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "vw_reportes_painel"
            referencedColumns: ["id"]
          },
        ]
      }
      reporte_eventos: {
        Row: {
          anexos: string[]
          autor_id: string
          criado_em: string
          estado_anterior: string | null
          estado_novo: string | null
          id: string
          reporte_id: string
          texto: string | null
          tipo: string
        }
        Insert: {
          anexos?: string[]
          autor_id: string
          criado_em?: string
          estado_anterior?: string | null
          estado_novo?: string | null
          id?: string
          reporte_id: string
          texto?: string | null
          tipo?: string
        }
        Update: {
          anexos?: string[]
          autor_id?: string
          criado_em?: string
          estado_anterior?: string | null
          estado_novo?: string | null
          id?: string
          reporte_id?: string
          texto?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "reporte_eventos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporte_eventos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "reporte_eventos_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporte_eventos_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "vw_reportes_painel"
            referencedColumns: ["id"]
          },
        ]
      }
      reporte_ficheiros: {
        Row: {
          caminho: string
          criado_em: string
          estado: string
          evento_id: string | null
          fase: string
          id: string
          ligado_em: string | null
          mime: string
          nome: string
          reporte_id: string | null
          resposta_id: string | null
          tamanho: number
          uploader_id: string
        }
        Insert: {
          caminho: string
          criado_em?: string
          estado?: string
          evento_id?: string | null
          fase: string
          id: string
          ligado_em?: string | null
          mime: string
          nome: string
          reporte_id?: string | null
          resposta_id?: string | null
          tamanho: number
          uploader_id: string
        }
        Update: {
          caminho?: string
          criado_em?: string
          estado?: string
          evento_id?: string | null
          fase?: string
          id?: string
          ligado_em?: string | null
          mime?: string
          nome?: string
          reporte_id?: string | null
          resposta_id?: string | null
          tamanho?: number
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reporte_ficheiros_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "reporte_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporte_ficheiros_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporte_ficheiros_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "vw_reportes_painel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporte_ficheiros_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "reporte_respostas_individuais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporte_ficheiros_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporte_ficheiros_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
        ]
      }
      reporte_notificacoes: {
        Row: {
          criado_em: string
          destinatario_id: string
          id: string
          lida_em: string | null
          mensagem: string
          reporte_id: string
        }
        Insert: {
          criado_em?: string
          destinatario_id: string
          id?: string
          lida_em?: string | null
          mensagem: string
          reporte_id: string
        }
        Update: {
          criado_em?: string
          destinatario_id?: string
          id?: string
          lida_em?: string | null
          mensagem?: string
          reporte_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reporte_notificacoes_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporte_notificacoes_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "reporte_notificacoes_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporte_notificacoes_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "vw_reportes_painel"
            referencedColumns: ["id"]
          },
        ]
      }
      reporte_respostas_individuais: {
        Row: {
          autor_id: string
          criado_em: string
          envolvido_id: string
          id: string
          resposta: string
          texto: string
        }
        Insert: {
          autor_id: string
          criado_em?: string
          envolvido_id: string
          id?: string
          resposta: string
          texto: string
        }
        Update: {
          autor_id?: string
          criado_em?: string
          envolvido_id?: string
          id?: string
          resposta?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "reporte_respostas_individuais_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reporte_respostas_individuais_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "reporte_respostas_individuais_envolvido_id_fkey"
            columns: ["envolvido_id"]
            isOneToOne: false
            referencedRelation: "reporte_envolvidos"
            referencedColumns: ["id"]
          },
        ]
      }
      reportes: {
        Row: {
          anexos: string[]
          apurado_em: string | null
          apurado_por: string | null
          assumido_por: string | null
          atualizado_em: string
          causa_alegada: string | null
          conclusao: string | null
          contestado_em: string | null
          correcao_resultado: string | null
          corrigido_por: string | null
          criado_em: string
          data_prevista: string | null
          descricao: string
          detetado_em: string | null
          erro_confirmado: boolean
          escalado_resolucao: boolean
          escalado_resposta: boolean
          estado: string
          evidencia_apuracao: string | null
          fechado_em: string | null
          gravidade: string
          id: string
          numero: string | null
          ocorrido_em: string | null
          prazo_resolucao: string | null
          prazo_resposta: string | null
          referencia_externa: string | null
          referencia_tipo: string | null
          reportado_por: string
          respondido_em: string | null
          responsaveis_apurados: string[]
          setor_destino_id: string
          setor_origem_id: string | null
          tipo_causa: string
          titulo: string
          up_care_referencia: string | null
          validacao_evidencia: string | null
          validado_por: string | null
        }
        Insert: {
          anexos?: string[]
          apurado_em?: string | null
          apurado_por?: string | null
          assumido_por?: string | null
          atualizado_em?: string
          causa_alegada?: string | null
          conclusao?: string | null
          contestado_em?: string | null
          correcao_resultado?: string | null
          corrigido_por?: string | null
          criado_em?: string
          data_prevista?: string | null
          descricao: string
          detetado_em?: string | null
          erro_confirmado?: boolean
          escalado_resolucao?: boolean
          escalado_resposta?: boolean
          estado?: string
          evidencia_apuracao?: string | null
          fechado_em?: string | null
          gravidade?: string
          id?: string
          numero?: string | null
          ocorrido_em?: string | null
          prazo_resolucao?: string | null
          prazo_resposta?: string | null
          referencia_externa?: string | null
          referencia_tipo?: string | null
          reportado_por: string
          respondido_em?: string | null
          responsaveis_apurados?: string[]
          setor_destino_id: string
          setor_origem_id?: string | null
          tipo_causa?: string
          titulo: string
          up_care_referencia?: string | null
          validacao_evidencia?: string | null
          validado_por?: string | null
        }
        Update: {
          anexos?: string[]
          apurado_em?: string | null
          apurado_por?: string | null
          assumido_por?: string | null
          atualizado_em?: string
          causa_alegada?: string | null
          conclusao?: string | null
          contestado_em?: string | null
          correcao_resultado?: string | null
          corrigido_por?: string | null
          criado_em?: string
          data_prevista?: string | null
          descricao?: string
          detetado_em?: string | null
          erro_confirmado?: boolean
          escalado_resolucao?: boolean
          escalado_resposta?: boolean
          estado?: string
          evidencia_apuracao?: string | null
          fechado_em?: string | null
          gravidade?: string
          id?: string
          numero?: string | null
          ocorrido_em?: string | null
          prazo_resolucao?: string | null
          prazo_resposta?: string | null
          referencia_externa?: string | null
          referencia_tipo?: string | null
          reportado_por?: string
          respondido_em?: string | null
          responsaveis_apurados?: string[]
          setor_destino_id?: string
          setor_origem_id?: string | null
          tipo_causa?: string
          titulo?: string
          up_care_referencia?: string | null
          validacao_evidencia?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reportes_apurado_por_fkey"
            columns: ["apurado_por"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_apurado_por_fkey"
            columns: ["apurado_por"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "reportes_assumido_por_fkey"
            columns: ["assumido_por"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_assumido_por_fkey"
            columns: ["assumido_por"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "reportes_corrigido_por_fkey"
            columns: ["corrigido_por"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_corrigido_por_fkey"
            columns: ["corrigido_por"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "reportes_reportado_por_fkey"
            columns: ["reportado_por"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_reportado_por_fkey"
            columns: ["reportado_por"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "reportes_setor_destino_id_fkey"
            columns: ["setor_destino_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_setor_origem_id_fkey"
            columns: ["setor_origem_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
        ]
      }
      rotina_bloco_excecoes: {
        Row: {
          bloco_id: string
          created_at: string
          created_by: string | null
          data: string
          id: string
          motivo: string | null
        }
        Insert: {
          bloco_id: string
          created_at?: string
          created_by?: string | null
          data: string
          id?: string
          motivo?: string | null
        }
        Update: {
          bloco_id?: string
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rotina_bloco_excecoes_bloco_id_fkey"
            columns: ["bloco_id"]
            isOneToOne: false
            referencedRelation: "rotina_blocos"
            referencedColumns: ["id"]
          },
        ]
      }
      rotina_blocos: {
        Row: {
          atividade_id: string
          cadencia: string
          created_at: string
          dia_semana: number
          funcionario_id: string
          grupo_id: string | null
          hora_fim: string
          hora_inicio: string
          id: string
          ordem: number
          updated_at: string
        }
        Insert: {
          atividade_id: string
          cadencia?: string
          created_at?: string
          dia_semana: number
          funcionario_id: string
          grupo_id?: string | null
          hora_fim: string
          hora_inicio: string
          id?: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          atividade_id?: string
          cadencia?: string
          created_at?: string
          dia_semana?: number
          funcionario_id?: string
          grupo_id?: string | null
          hora_fim?: string
          hora_inicio?: string
          id?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotina_blocos_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotina_blocos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotina_blocos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
        ]
      }
      rotina_templates: {
        Row: {
          created_at: string
          dia_semana: number
          funcao_id: string
          id: string
        }
        Insert: {
          created_at?: string
          dia_semana: number
          funcao_id: string
          id?: string
        }
        Update: {
          created_at?: string
          dia_semana?: number
          funcao_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotina_templates_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_dia: {
        Row: {
          atividade_id: string | null
          bloco_id: string | null
          created_at: string
          data: string
          estado: string
          funcionario_id: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          minutos_previstos: number
          ordem: number
          template_tarefa_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          atividade_id?: string | null
          bloco_id?: string | null
          created_at?: string
          data: string
          estado?: string
          funcionario_id: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          minutos_previstos?: number
          ordem?: number
          template_tarefa_id?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          atividade_id?: string | null
          bloco_id?: string | null
          created_at?: string
          data?: string
          estado?: string
          funcionario_id?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          minutos_previstos?: number
          ordem?: number
          template_tarefa_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_dia_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_dia_bloco_id_fkey"
            columns: ["bloco_id"]
            isOneToOne: false
            referencedRelation: "rotina_blocos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_dia_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_dia_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "tarefas_dia_template_tarefa_id_fkey"
            columns: ["template_tarefa_id"]
            isOneToOne: false
            referencedRelation: "template_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      template_tarefas: {
        Row: {
          created_at: string
          descricao: string
          hora_sugerida: string | null
          id: string
          minutos_previstos: number
          ordem: number
          template_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          descricao?: string
          hora_sugerida?: string | null
          id?: string
          minutos_previstos?: number
          ordem?: number
          template_id: string
          tipo?: string
          titulo: string
        }
        Update: {
          created_at?: string
          descricao?: string
          hora_sugerida?: string | null
          id?: string
          minutos_previstos?: number
          ordem?: number
          template_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_tarefas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rotina_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_atividade_colaborador: {
        Row: {
          execucoes_concluidas: number | null
          funcionario_id: string | null
          itens_nok: number | null
          itens_respondidos: number | null
          mes: string | null
          nome: string | null
          reportes_assumidos: number | null
          reportes_criados: number | null
        }
        Relationships: []
      }
      vw_cumprimento_checklists: {
        Row: {
          alvo: string | null
          checklist: string | null
          concluida_em: string | null
          concluida_por: string | null
          data_referencia: string | null
          estado: string | null
          execucao_id: string | null
          itens_nok: number | null
          itens_respondidos: number | null
          itens_total: number | null
          periodicidade: string | null
          setor: string | null
          setor_id: string | null
          template_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_desempenho_setor: {
        Row: {
          contestados: number | null
          em_tratamento: number | null
          fechados: number | null
          media_h_resolucao: number | null
          media_h_resposta: number | null
          mes: string | null
          pendentes: number | null
          recusados: number | null
          resolucao_atrasada: number | null
          resposta_atrasada: number | null
          setor_destino: string | null
          setor_destino_id: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reportes_setor_destino_id_fkey"
            columns: ["setor_destino_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_reportes_painel: {
        Row: {
          assumido_por: string | null
          assumido_por_nome: string | null
          criado_em: string | null
          data_prevista: string | null
          estado: string | null
          fechado_em: string | null
          foi_contestado: boolean | null
          gravidade: string | null
          horas_ate_resolucao: number | null
          horas_ate_resposta: number | null
          id: string | null
          n_comentarios: number | null
          n_decisoes: number | null
          numero: string | null
          prazo_resolucao: string | null
          prazo_resposta: string | null
          reportado_por: string | null
          reportado_por_nome: string | null
          resolucao_em_atraso: boolean | null
          respondido_em: string | null
          resposta_em_atraso: boolean | null
          setor_destino: string | null
          setor_destino_id: string | null
          setor_origem: string | null
          setor_origem_id: string | null
          titulo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reportes_assumido_por_fkey"
            columns: ["assumido_por"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_assumido_por_fkey"
            columns: ["assumido_por"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "reportes_reportado_por_fkey"
            columns: ["reportado_por"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_reportado_por_fkey"
            columns: ["reportado_por"]
            isOneToOne: false
            referencedRelation: "vw_atividade_colaborador"
            referencedColumns: ["funcionario_id"]
          },
          {
            foreignKeyName: "reportes_setor_destino_id_fkey"
            columns: ["setor_destino_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reportes_setor_origem_id_fkey"
            columns: ["setor_origem_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _garantir_atividade: {
        Args: { _funcionario_id: string; _minutos: number; _titulo: string }
        Returns: string
      }
      associar_user_a_funcionario: {
        Args: { _funcionario_id: string; _user_id: string }
        Returns: undefined
      }
      cadencia_aplica: {
        Args: { _cadencia: string; _data: string }
        Returns: boolean
      }
      central_diretorio: { Args: never; Returns: Json }
      central_gerir: { Args: { p_id: string }; Returns: boolean }
      central_gestor: { Args: never; Returns: boolean }
      central_ler_notificacoes: { Args: never; Returns: undefined }
      central_lista: { Args: never; Returns: Json }
      central_metricas: { Args: never; Returns: Json }
      central_notificar: {
        Args: { p_id: string; p_texto: string }
        Returns: undefined
      }
      central_storage_ver: {
        Args: { p_bucket: string; p_path: string }
        Returns: boolean
      }
      central_submeter: {
        Args: { p_acao: string; p_dados: Json; p_ficheiros?: string[] }
        Returns: Json
      }
      central_ver: { Args: { p_id: string }; Returns: boolean }
      copiar_rotina_dia: {
        Args: {
          _dia_origem: number
          _dias_destino: number[]
          _funcionario_id: string
        }
        Returns: undefined
      }
      criar_urgencia_gestor: {
        Args: {
          _descricao: string
          _funcionario_id: string
          _prioridade?: string
          _titulo: string
        }
        Returns: string
      }
      definir_papel_funcionario: {
        Args: { _funcionario_id: string; _papel: string }
        Returns: undefined
      }
      desassociar_user_de_funcionario: {
        Args: { _funcionario_id: string }
        Returns: undefined
      }
      fechar_evento: {
        Args: { _evento_id: string; _retomar?: boolean }
        Returns: string
      }
      funcionario_tem_historico: {
        Args: { _funcionario_id: string }
        Returns: boolean
      }
      gerar_dados_demo: { Args: { _data: string }; Returns: undefined }
      gerar_tarefas_do_dia: {
        Args: { _data: string; _funcionario_id: string }
        Returns: {
          estado: string
          id: string
          minutos_previstos: number
          ordem: number
          titulo: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      iniciar_urgencia: { Args: { _evento_id: string }; Returns: undefined }
      is_my_funcionario: { Args: { _funcionario_id: string }; Returns: boolean }
      limpar_dados_demo: { Args: { _data: string }; Returns: undefined }
      listar_funcionarios_com_email: {
        Args: never
        Returns: {
          ativo: boolean
          cor: string
          email: string
          funcao_id: string
          id: string
          nome: string
          papel: string
          setores: Json
          user_id: string
        }[]
      }
      listar_users_nao_associados: {
        Args: never
        Returns: {
          email: string
          id: string
        }[]
      }
      marcar_eventos_lidos: {
        Args: { _funcionario_id: string }
        Returns: undefined
      }
      migrar_templates_para_blocos: { Args: never; Returns: undefined }
      pausar_urgencia: {
        Args: { _evento_id: string; _motivo?: string }
        Returns: undefined
      }
      proxima_cor_funcionario: { Args: never; Returns: string }
      questao_visivel: { Args: { _questao_id: string }; Returns: boolean }
      rc_add_horas_uteis: {
        Args: { p_horas: number; p_inicio: string }
        Returns: string
      }
      rc_cfg: { Args: { p_chave: string; p_default: string }; Returns: string }
      rc_e_dia_util: { Args: { p_data: string }; Returns: boolean }
      rc_e_gestor: { Args: never; Returns: boolean }
      rc_e_responsavel: { Args: { p_setor: string }; Returns: boolean }
      rc_gerar_execucoes: { Args: { p_data?: string }; Returns: number }
      rc_horas_uteis_entre: {
        Args: { p_fim: string; p_ini: string }
        Returns: number
      }
      rc_manutencao_horaria: { Args: never; Returns: undefined }
      rc_marcar_em_falta: { Args: never; Returns: number }
      rc_meu_funcionario_id: { Args: never; Returns: string }
      rc_meus_setores: { Args: never; Returns: string[] }
      rc_mudar_estado: {
        Args: {
          p_data_prevista?: string
          p_novo_estado: string
          p_reporte: string
          p_texto: string
        }
        Returns: {
          anexos: string[]
          apurado_em: string | null
          apurado_por: string | null
          assumido_por: string | null
          atualizado_em: string
          causa_alegada: string | null
          conclusao: string | null
          contestado_em: string | null
          correcao_resultado: string | null
          corrigido_por: string | null
          criado_em: string
          data_prevista: string | null
          descricao: string
          detetado_em: string | null
          erro_confirmado: boolean
          escalado_resolucao: boolean
          escalado_resposta: boolean
          estado: string
          evidencia_apuracao: string | null
          fechado_em: string | null
          gravidade: string
          id: string
          numero: string | null
          ocorrido_em: string | null
          prazo_resolucao: string | null
          prazo_resposta: string | null
          referencia_externa: string | null
          referencia_tipo: string | null
          reportado_por: string
          respondido_em: string | null
          responsaveis_apurados: string[]
          setor_destino_id: string
          setor_origem_id: string | null
          tipo_causa: string
          titulo: string
          up_care_referencia: string | null
          validacao_evidencia: string | null
          validado_por: string | null
        }
        SetofOptions: {
          from: "*"
          to: "reportes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rc_pertence_setor: { Args: { p_setor: string }; Returns: boolean }
      rc_processar_escalonamentos: { Args: never; Returns: number }
      rc_reclassificar: {
        Args: { p_motivo: string; p_nova: string; p_reporte: string }
        Returns: undefined
      }
      rc_registar_decisao: {
        Args: { p_reporte: string; p_texto: string }
        Returns: {
          anexos: string[]
          autor_id: string
          criado_em: string
          estado_anterior: string | null
          estado_novo: string | null
          id: string
          reporte_id: string
          texto: string | null
          tipo: string
        }
        SetofOptions: {
          from: "*"
          to: "reporte_eventos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remover_excecao_bloco: {
        Args: { _bloco_id: string; _data: string }
        Returns: undefined
      }
      retomar_urgencia: { Args: { _evento_id: string }; Returns: undefined }
      saltar_bloco_data: {
        Args: { _bloco_id: string; _data: string; _motivo?: string }
        Returns: undefined
      }
      tarefa_pertence_a_mim: {
        Args: { _tarefa_dia_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "gestor" | "funcionario"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["gestor", "funcionario"],
    },
  },
} as const
