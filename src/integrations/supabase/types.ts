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
      eventos: {
        Row: {
          created_at: string
          criado_por: string
          descricao: string
          fim: string | null
          funcionario_id: string
          id: string
          inicio: string
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          descricao?: string
          fim?: string | null
          funcionario_id: string
          id?: string
          inicio?: string
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          descricao?: string
          fim?: string | null
          funcionario_id?: string
          id?: string
          inicio?: string
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
      funcionarios: {
        Row: {
          ativo: boolean
          created_at: string
          funcao_id: string | null
          id: string
          nome: string
          papel: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          funcao_id?: string | null
          id?: string
          nome: string
          papel: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
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
          created_at: string
          data: string
          estado: string
          funcionario_id: string
          id: string
          minutos_previstos: number
          ordem: number
          template_tarefa_id: string | null
          titulo: string
        }
        Insert: {
          created_at?: string
          data: string
          estado?: string
          funcionario_id: string
          id?: string
          minutos_previstos?: number
          ordem?: number
          template_tarefa_id?: string | null
          titulo: string
        }
        Update: {
          created_at?: string
          data?: string
          estado?: string
          funcionario_id?: string
          id?: string
          minutos_previstos?: number
          ordem?: number
          template_tarefa_id?: string | null
          titulo?: string
        }
        Relationships: [
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
