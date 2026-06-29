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
      eventos: {
        Row: {
          created_at: string
          criado_por: string
          descricao: string
          estado: string
          fim: string | null
          funcionario_id: string
          id: string
          inicio: string
          lido: boolean
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
          inicio?: string
          lido?: boolean
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
          inicio?: string
          lido?: boolean
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
      funcionario_setores: {
        Row: {
          created_at: string
          funcao_id: string
          funcionario_id: string
          id: string
        }
        Insert: {
          created_at?: string
          funcao_id: string
          funcionario_id: string
          id?: string
        }
        Update: {
          created_at?: string
          funcao_id?: string
          funcionario_id?: string
          id?: string
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
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
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
            foreignKeyName: "questoes_tarefa_dia_id_fkey"
            columns: ["tarefa_dia_id"]
            isOneToOne: false
            referencedRelation: "tarefas_dia"
            referencedColumns: ["id"]
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
      [_ in never]: never
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
      proxima_cor_funcionario: { Args: never; Returns: string }
      questao_visivel: { Args: { _questao_id: string }; Returns: boolean }
      remover_excecao_bloco: {
        Args: { _bloco_id: string; _data: string }
        Returns: undefined
      }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
