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
      announcement_recipients: {
        Row: {
          announcement_id: string
          responded_at: string | null
          response: Json | null
          seen_at: string | null
          user_id: string
        }
        Insert: {
          announcement_id: string
          responded_at?: string | null
          response?: Json | null
          seen_at?: string | null
          user_id: string
        }
        Update: {
          announcement_id?: string
          responded_at?: string | null
          response?: Json | null
          seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_recipients_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          household_id: string
          id: string
          priority: Database["public"]["Enums"]["priority_level"]
          published_at: string | null
          response_config: Json
          state: Database["public"]["Enums"]["announcement_state"]
          title: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          household_id: string
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          published_at?: string | null
          response_config?: Json
          state?: Database["public"]["Enums"]["announcement_state"]
          title: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          household_id?: string
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          published_at?: string | null
          response_config?: Json
          state?: Database["public"]["Enums"]["announcement_state"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          file_name: string
          household_id: string
          id: string
          mime_type: string | null
          object_id: string
          object_type: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          file_name: string
          household_id: string
          id?: string
          mime_type?: string | null
          object_id: string
          object_type: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          file_name?: string
          household_id?: string
          id?: string
          mime_type?: string | null
          object_id?: string
          object_type?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_type: string
          actor_user_id: string | null
          changes: Json | null
          correlation_id: string | null
          created_at: string
          household_id: string
          id: string
          object_id: string | null
          object_type: string
        }
        Insert: {
          action: string
          actor_type?: string
          actor_user_id?: string | null
          changes?: Json | null
          correlation_id?: string | null
          created_at?: string
          household_id: string
          id?: string
          object_id?: string | null
          object_type: string
        }
        Update: {
          action?: string
          actor_type?: string
          actor_user_id?: string | null
          changes?: Json | null
          correlation_id?: string | null
          created_at?: string
          household_id?: string
          id?: string
          object_id?: string | null
          object_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          created_at: string
          credential_ref: string
          external_account_id: string | null
          household_id: string
          id: string
          last_synced_at: string | null
          provider: string
          share_mode: string
          sync_state: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_ref: string
          external_account_id?: string | null
          household_id: string
          id?: string
          last_synced_at?: string | null
          provider: string
          share_mode?: string
          sync_state?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          credential_ref?: string
          external_account_id?: string | null
          household_id?: string
          id?: string
          last_synced_at?: string | null
          provider?: string
          share_mode?: string
          sync_state?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_connections_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          household_id: string
          id: string
          object_id: string
          object_type: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          household_id: string
          id?: string
          object_id: string
          object_type: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          household_id?: string
          id?: string
          object_id?: string
          object_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          attendance_status: string
          event_id: string
          user_id: string
        }
        Insert: {
          attendance_status?: string
          event_id: string
          user_id: string
        }
        Update: {
          attendance_status?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day_end: string | null
          all_day_start: string | null
          created_at: string
          creator_id: string | null
          deleted_at: string | null
          description: string | null
          ends_at: string | null
          household_id: string
          id: string
          location_text: string | null
          privacy: string
          provider_calendar_id: string | null
          provider_connection_id: string | null
          provider_event_id: string | null
          provider_metadata: Json
          recurrence_rule: string | null
          source: string
          starts_at: string | null
          status: string
          timezone: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day_end?: string | null
          all_day_start?: string | null
          created_at?: string
          creator_id?: string | null
          deleted_at?: string | null
          description?: string | null
          ends_at?: string | null
          household_id: string
          id?: string
          location_text?: string | null
          privacy?: string
          provider_calendar_id?: string | null
          provider_connection_id?: string | null
          provider_event_id?: string | null
          provider_metadata?: Json
          recurrence_rule?: string | null
          source?: string
          starts_at?: string | null
          status?: string
          timezone?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day_end?: string | null
          all_day_start?: string | null
          created_at?: string
          creator_id?: string | null
          deleted_at?: string | null
          description?: string | null
          ends_at?: string | null
          household_id?: string
          id?: string
          location_text?: string | null
          privacy?: string
          provider_calendar_id?: string | null
          provider_connection_id?: string | null
          provider_event_id?: string | null
          provider_metadata?: Json
          recurrence_rule?: string | null
          source?: string
          starts_at?: string | null
          status?: string
          timezone?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_provider_connection_id_fkey"
            columns: ["provider_connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      home_assets: {
        Row: {
          category: string
          condition: string | null
          created_at: string
          deleted_at: string | null
          expected_life_years: number | null
          household_id: string
          id: string
          installed_on: string | null
          location_id: string | null
          manufacturer: string | null
          metadata: Json
          model: string | null
          name: string
          purchased_on: string | null
          serial_number: string | null
          warranty_expires_on: string | null
        }
        Insert: {
          category: string
          condition?: string | null
          created_at?: string
          deleted_at?: string | null
          expected_life_years?: number | null
          household_id: string
          id?: string
          installed_on?: string | null
          location_id?: string | null
          manufacturer?: string | null
          metadata?: Json
          model?: string | null
          name: string
          purchased_on?: string | null
          serial_number?: string | null
          warranty_expires_on?: string | null
        }
        Update: {
          category?: string
          condition?: string | null
          created_at?: string
          deleted_at?: string | null
          expected_life_years?: number | null
          household_id?: string
          id?: string
          installed_on?: string | null
          location_id?: string | null
          manufacturer?: string | null
          metadata?: Json
          model?: string | null
          name?: string
          purchased_on?: string | null
          serial_number?: string | null
          warranty_expires_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "home_assets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_assets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          expires_at: string
          household_id: string
          id: string
          invited_email: string | null
          role: Database["public"]["Enums"]["member_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          household_id: string
          id?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_memberships: {
        Row: {
          created_at: string
          display_label: string | null
          expires_at: string | null
          household_id: string
          id: string
          invite_email: string | null
          permission_overrides: Json
          role: Database["public"]["Enums"]["member_role"]
          state: Database["public"]["Enums"]["membership_state"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_label?: string | null
          expires_at?: string | null
          household_id: string
          id?: string
          invite_email?: string | null
          permission_overrides?: Json
          role: Database["public"]["Enums"]["member_role"]
          state?: Database["public"]["Enums"]["membership_state"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_label?: string | null
          expires_at?: string | null
          household_id?: string
          id?: string
          invite_email?: string | null
          permission_overrides?: Json
          role?: Database["public"]["Enums"]["member_role"]
          state?: Database["public"]["Enums"]["membership_state"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_memberships_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          name: string
          settings: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          name: string
          settings?: Json
          timezone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          name?: string
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_catalog: {
        Row: {
          barcode: string | null
          brand: string | null
          category: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          full_name: string | null
          household_id: string
          id: string
          name: string
          sku: string | null
          source: string
          store: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          full_name?: string | null
          household_id: string
          id?: string
          name: string
          sku?: string | null
          source?: string
          store?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          full_name?: string | null
          household_id?: string
          id?: string
          name?: string
          sku?: string | null
          source?: string
          store?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_catalog_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_catalog_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_shifts: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          deleted_at: string | null
          detail: string | null
          household_id: string
          id: string
          original_claimed_by: string | null
          role: Database["public"]["Enums"]["kitchen_role"]
          shift_date: string
          skipped_at: string | null
          updated_at: string
          version: number
          week_start: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          detail?: string | null
          household_id: string
          id?: string
          original_claimed_by?: string | null
          role: Database["public"]["Enums"]["kitchen_role"]
          shift_date: string
          skipped_at?: string | null
          updated_at?: string
          version?: number
          week_start: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          deleted_at?: string | null
          detail?: string | null
          household_id?: string
          id?: string
          original_claimed_by?: string | null
          role?: Database["public"]["Enums"]["kitchen_role"]
          shift_date?: string
          skipped_at?: string | null
          updated_at?: string
          version?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_shifts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_shifts_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_shifts_original_claimed_by_fkey"
            columns: ["original_claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_shifts_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_lots: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expires_on: string | null
          household_id: string
          id: string
          item_id: string
          note: string | null
          opened_on: string | null
          purchased_on: string | null
          quantity: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_on?: string | null
          household_id: string
          id?: string
          item_id: string
          note?: string | null
          opened_on?: string | null
          purchased_on?: string | null
          quantity?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_on?: string | null
          household_id?: string
          id?: string
          item_id?: string
          note?: string | null
          opened_on?: string | null
          purchased_on?: string | null
          quantity?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          inventory_item_id: string | null
          match_name: string | null
          name: string
          optional: boolean
          quantity: number | null
          recipe_id: string
          sort_order: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          inventory_item_id?: string | null
          match_name?: never
          name: string
          optional?: boolean
          quantity?: number | null
          recipe_id: string
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          inventory_item_id?: string | null
          match_name?: never
          name?: string
          optional?: boolean
          quantity?: number | null
          recipe_id?: string
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          household_id: string
          id: string
          item_id: string
          note: string | null
          reason: Database["public"]["Enums"]["inventory_reason"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          household_id: string
          id?: string
          item_id: string
          note?: string | null
          reason: Database["public"]["Enums"]["inventory_reason"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          household_id?: string
          id?: string
          item_id?: string
          note?: string | null
          reason?: Database["public"]["Enums"]["inventory_reason"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          approximate_level:
            | Database["public"]["Enums"]["inventory_level"]
            | null
          barcode: string | null
          brand: string | null
          category: string | null
          count_mode: Database["public"]["Enums"]["inventory_count_mode"]
          deleted_at: string | null
          expires_on: string | null
          household_id: string
          id: string
          location_id: string | null
          last_counted_at: string | null
          min_quantity: number | null
          name: string
          notes: string | null
          par_quantity: number | null
          preferred_store: string | null
          purchased_on: string | null
          quantity: number | null
          reserved_quantity: number
          unit: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approximate_level?:
            | Database["public"]["Enums"]["inventory_level"]
            | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          count_mode?: Database["public"]["Enums"]["inventory_count_mode"]
          deleted_at?: string | null
          expires_on?: string | null
          household_id: string
          id?: string
          location_id?: string | null
          last_counted_at?: string | null
          min_quantity?: number | null
          name: string
          notes?: string | null
          par_quantity?: number | null
          preferred_store?: string | null
          purchased_on?: string | null
          quantity?: number | null
          reserved_quantity?: number
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approximate_level?:
            | Database["public"]["Enums"]["inventory_level"]
            | null
          barcode?: string | null
          brand?: string | null
          category?: string | null
          count_mode?: Database["public"]["Enums"]["inventory_count_mode"]
          deleted_at?: string | null
          expires_on?: string | null
          household_id?: string
          id?: string
          location_id?: string | null
          last_counted_at?: string | null
          min_quantity?: number | null
          name?: string
          notes?: string | null
          par_quantity?: number | null
          preferred_store?: string | null
          purchased_on?: string | null
          quantity?: number | null
          reserved_quantity?: number
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          deleted_at: string | null
          household_id: string
          id: string
          location_type: string
          name: string
          parent_id: string | null
          property_id: string
          sort_order: number
        }
        Insert: {
          deleted_at?: string | null
          household_id: string
          id?: string
          location_type: string
          name: string
          parent_id?: string | null
          property_id: string
          sort_order?: number
        }
        Update: {
          deleted_at?: string | null
          household_id?: string
          id?: string
          location_type?: string
          name?: string
          parent_id?: string | null
          property_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "locations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_issues: {
        Row: {
          asset_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          household_id: string
          id: string
          location_id: string | null
          noticed_at: string | null
          owner_id: string | null
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          state: Database["public"]["Enums"]["issue_state"]
          title: string
          updated_at: string
          urgency: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          household_id: string
          id?: string
          location_id?: string | null
          noticed_at?: string | null
          owner_id?: string | null
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          state?: Database["public"]["Enums"]["issue_state"]
          title: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          household_id?: string
          id?: string
          location_id?: string | null
          noticed_at?: string | null
          owner_id?: string | null
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          state?: Database["public"]["Enums"]["issue_state"]
          title?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_issues_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "home_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_issues_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_issues_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_issues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_issues_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          asset_id: string
          cadence_days: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          last_done_on: string | null
          next_due_on: string
          title: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          cadence_days: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          last_done_on?: string | null
          next_due_on: string
          title: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          cadence_days?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          last_done_on?: string | null
          next_due_on?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "home_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_ingredient_reservations: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          inventory_item_id: string
          meal_id: string
          quantity: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          inventory_item_id: string
          meal_id: string
          quantity?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          inventory_item_id?: string
          meal_id?: string
          quantity?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_ingredient_reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_ingredient_reservations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_ingredient_reservations_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_ingredient_reservations_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_responses: {
        Row: {
          guest_count: number
          meal_id: string
          responded_at: string
          response: Database["public"]["Enums"]["meal_response_state"]
          user_id: string
        }
        Insert: {
          guest_count?: number
          meal_id: string
          responded_at?: string
          response: Database["public"]["Enums"]["meal_response_state"]
          user_id: string
        }
        Update: {
          guest_count?: number
          meal_id?: string
          responded_at?: string
          response?: Database["public"]["Enums"]["meal_response_state"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_responses_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          expected_servings: number | null
          household_id: string
          id: string
          meal_type: string
          notes: string | null
          planned_at: string
          prep_owner_id: string | null
          recipe_id: string | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          expected_servings?: number | null
          household_id: string
          id?: string
          meal_type?: string
          notes?: string | null
          planned_at: string
          prep_owner_id?: string | null
          recipe_id?: string | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          expected_servings?: number | null
          household_id?: string
          id?: string
          meal_type?: string
          notes?: string | null
          planned_at?: string
          prep_owner_id?: string | null
          recipe_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meals_prep_owner_id_fkey"
            columns: ["prep_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meals_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action: Json | null
          body: string | null
          canceled_at: string | null
          created_at: string
          dedupe_key: string | null
          household_id: string
          id: string
          priority: string
          read_at: string | null
          reason: string
          scheduled_for: string | null
          sent_at: string | null
          source_id: string
          source_type: string
          title: string
          user_id: string
        }
        Insert: {
          action?: Json | null
          body?: string | null
          canceled_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          household_id: string
          id?: string
          priority: string
          read_at?: string | null
          reason: string
          scheduled_for?: string | null
          sent_at?: string | null
          source_id: string
          source_type: string
          title: string
          user_id: string
        }
        Update: {
          action?: Json | null
          body?: string | null
          canceled_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          household_id?: string
          id?: string
          priority?: string
          read_at?: string | null
          reason?: string
          scheduled_for?: string | null
          sent_at?: string | null
          source_id?: string
          source_type?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_responses: {
        Row: {
          poll_id: string
          responded_at: string
          response: Json
          user_id: string
        }
        Insert: {
          poll_id: string
          responded_at?: string
          response: Json
          user_id: string
        }
        Update: {
          poll_id?: string
          responded_at?: string
          response?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_responses_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          closed_at: string | null
          closes_at: string | null
          created_at: string
          creator_id: string
          decision_owner_id: string | null
          decision_rule: string
          deleted_at: string | null
          final_decision: Json | null
          household_id: string
          id: string
          options: Json
          question: string
          response_mode: string
          version: number
        }
        Insert: {
          closed_at?: string | null
          closes_at?: string | null
          created_at?: string
          creator_id: string
          decision_owner_id?: string | null
          decision_rule?: string
          deleted_at?: string | null
          final_decision?: Json | null
          household_id: string
          id?: string
          options: Json
          question: string
          response_mode?: string
          version?: number
        }
        Update: {
          closed_at?: string | null
          closes_at?: string | null
          created_at?: string
          creator_id?: string
          decision_owner_id?: string | null
          decision_rule?: string
          deleted_at?: string | null
          final_decision?: Json | null
          household_id?: string
          id?: string
          options?: Json
          question?: string
          response_mode?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "polls_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_decision_owner_id_fkey"
            columns: ["decision_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string
          id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name: string
          id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: Json | null
          created_at: string
          deleted_at: string | null
          household_id: string
          id: string
          is_primary: boolean
          name: string
          timezone: string | null
        }
        Insert: {
          address?: Json | null
          created_at?: string
          deleted_at?: string | null
          household_id: string
          id?: string
          is_primary?: boolean
          name: string
          timezone?: string | null
        }
        Update: {
          address?: Json | null
          created_at?: string
          deleted_at?: string | null
          household_id?: string
          id?: string
          is_primary?: boolean
          name?: string
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          actual_prep_minutes: number | null
          created_at: string
          created_by: string | null
          default_servings: number | null
          deleted_at: string | null
          household_id: string
          household_notes: string | null
          id: string
          ingredients: Json
          instructions: Json
          name: string
          source_url: string | null
        }
        Insert: {
          actual_prep_minutes?: number | null
          created_at?: string
          created_by?: string | null
          default_servings?: number | null
          deleted_at?: string | null
          household_id: string
          household_notes?: string | null
          id?: string
          ingredients?: Json
          instructions?: Json
          name: string
          source_url?: string | null
        }
        Update: {
          actual_prep_minutes?: number | null
          created_at?: string
          created_by?: string | null
          default_servings?: number | null
          deleted_at?: string | null
          household_id?: string
          household_notes?: string | null
          id?: string
          ingredients?: Json
          instructions?: Json
          name?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_passengers: {
        Row: {
          ride_id: string
          user_id: string
        }
        Insert: {
          ride_id: string
          user_id: string
        }
        Update: {
          ride_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_passengers_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_passengers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_updates: {
        Row: {
          author_id: string
          created_at: string
          household_id: string
          id: string
          kind: string
          note: string
          ride_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          household_id: string
          id?: string
          kind?: string
          note: string
          ride_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          household_id?: string
          id?: string
          kind?: string
          note?: string
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_updates_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_updates_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          arrive_by: string | null
          created_at: string
          deleted_at: string | null
          depart_by: string | null
          destination_text: string
          driver_id: string | null
          event_id: string | null
          household_id: string
          id: string
          notes: string | null
          pickup_text: string
          requester_id: string
          state: Database["public"]["Enums"]["ride_state"]
          updated_at: string
          vehicle_label: string | null
          version: number
        }
        Insert: {
          arrive_by?: string | null
          created_at?: string
          deleted_at?: string | null
          depart_by?: string | null
          destination_text: string
          driver_id?: string | null
          event_id?: string | null
          household_id: string
          id?: string
          notes?: string | null
          pickup_text: string
          requester_id: string
          state?: Database["public"]["Enums"]["ride_state"]
          updated_at?: string
          vehicle_label?: string | null
          version?: number
        }
        Update: {
          arrive_by?: string | null
          created_at?: string
          deleted_at?: string | null
          depart_by?: string | null
          destination_text?: string
          driver_id?: string | null
          event_id?: string | null
          household_id?: string
          id?: string
          notes?: string | null
          pickup_text?: string
          requester_id?: string
          state?: Database["public"]["Enums"]["ride_state"]
          updated_at?: string
          vehicle_label?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_records: {
        Row: {
          asset_id: string | null
          cost: number | null
          created_at: string
          created_by: string
          deleted_at: string | null
          diagnosis: string | null
          follow_up_on: string | null
          household_id: string
          id: string
          issue_id: string | null
          parts: Json
          provider_name: string | null
          serviced_on: string
          warranty_notes: string | null
          work_performed: string
        }
        Insert: {
          asset_id?: string | null
          cost?: number | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          diagnosis?: string | null
          follow_up_on?: string | null
          household_id: string
          id?: string
          issue_id?: string | null
          parts?: Json
          provider_name?: string | null
          serviced_on: string
          warranty_notes?: string | null
          work_performed: string
        }
        Update: {
          asset_id?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          diagnosis?: string | null
          follow_up_on?: string | null
          household_id?: string
          id?: string
          issue_id?: string | null
          parts?: Json
          provider_name?: string | null
          serviced_on?: string
          warranty_notes?: string | null
          work_performed?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_records_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "home_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "maintenance_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          category: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          household_id: string
          id: string
          inventory_item_id: string | null
          name: string
          needed_by: string | null
          preferred_brand: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          quantity: number | null
          requester_id: string
          state: Database["public"]["Enums"]["request_state"]
          stock_note: string | null
          stocked_at: string | null
          store: string | null
          substitutions: string | null
          unit: string | null
        }
        Insert: {
          category?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          household_id: string
          id?: string
          inventory_item_id?: string | null
          name: string
          needed_by?: string | null
          preferred_brand?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          quantity?: number | null
          requester_id: string
          state?: Database["public"]["Enums"]["request_state"]
          stock_note?: string | null
          stocked_at?: string | null
          store?: string | null
          substitutions?: string | null
          unit?: string | null
        }
        Update: {
          category?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          household_id?: string
          id?: string
          inventory_item_id?: string | null
          name?: string
          needed_by?: string | null
          preferred_brand?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          quantity?: number | null
          requester_id?: string
          state?: Database["public"]["Enums"]["request_state"]
          stock_note?: string | null
          stocked_at?: string | null
          store?: string | null
          substitutions?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category: string | null
          created_at: string
          creator_id: string
          deleted_at: string | null
          description: string | null
          due_at: string | null
          household_id: string
          id: string
          owner_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          recurrence_rule: string | null
          recurrence_template_id: string | null
          related_id: string | null
          related_type: string | null
          state: Database["public"]["Enums"]["task_state"]
          title: string
          updated_at: string
          verification_required: boolean
          version: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          creator_id: string
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          household_id: string
          id?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          recurrence_rule?: string | null
          recurrence_template_id?: string | null
          related_id?: string | null
          related_type?: string | null
          state?: Database["public"]["Enums"]["task_state"]
          title: string
          updated_at?: string
          verification_required?: boolean
          version?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          creator_id?: string
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          household_id?: string
          id?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          recurrence_rule?: string | null
          recurrence_template_id?: string | null
          related_id?: string | null
          related_type?: string | null
          state?: Database["public"]["Enums"]["task_state"]
          title?: string
          updated_at?: string
          verification_required?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurrence_template_id_fkey"
            columns: ["recurrence_template_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      my_calendar_connections: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          household_id: string
          provider: string
          external_account_id: string | null
          share_mode: string
          last_synced_at: string | null
          last_error: string | null
          created_at: string
        }[]
      }
      ensure_kitchen_week: {
        Args: { p_household: string; p_week_start: string }
        Returns: number
      }
      claim_shift: {
        Args: { p_shift: string; p_expected_version: number }
        Returns: Database["public"]["Tables"]["kitchen_shifts"]["Row"]
      }
      release_shift: {
        Args: { p_shift: string; p_expected_version: number }
        Returns: Database["public"]["Tables"]["kitchen_shifts"]["Row"]
      }
      cover_shift: {
        Args: { p_shift: string; p_user: string; p_expected_version: number }
        Returns: Database["public"]["Tables"]["kitchen_shifts"]["Row"]
      }
      complete_shift: {
        Args: { p_shift: string; p_expected_version: number }
        Returns: Database["public"]["Tables"]["kitchen_shifts"]["Row"]
      }
      skip_shift: {
        Args: { p_shift: string; p_expected_version: number }
        Returns: Database["public"]["Tables"]["kitchen_shifts"]["Row"]
      }
      copy_kitchen_week: {
        Args: { p_household: string; p_from: string; p_to: string }
        Returns: number
      }
      consume_lot: {
        Args: {
          p_lot: string
          p_amount: number
          p_reason?: Database["public"]["Enums"]["inventory_reason"]
          p_note?: string | null
        }
        Returns: number
      }
      cook_meal: {
        Args: { p_meal: string }
        Returns: number
      }
      recipe_pantry_match: {
        Args: { p_household: string }
        Returns: {
          recipe_id: string
          recipe_name: string
          required_count: number
          have_count: number
          missing: string[]
        }[]
      }
      claim_task: {
        Args: { p_task_id: string; p_expected_version: number }
        Returns: Database["public"]["Tables"]["tasks"]["Row"]
      }
      complete_maintenance: {
        Args: { p_schedule_id: string }
        Returns: Database["public"]["Tables"]["maintenance_schedules"]["Row"]
      }
      complete_task: {
        Args: { p_task_id: string; p_expected_version: number }
        Returns: Database["public"]["Tables"]["tasks"]["Row"]
      }
      materialize_next_task: {
        Args: { p_task_id: string }
        Returns: Database["public"]["Tables"]["tasks"]["Row"]
      }
      accept_invite: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          display_label: string | null
          expires_at: string | null
          household_id: string
          id: string
          invite_email: string | null
          permission_overrides: Json
          role: Database["public"]["Enums"]["member_role"]
          state: Database["public"]["Enums"]["membership_state"]
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "household_memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_ride: {
        Args: { p_expected_version: number; p_ride_id: string }
        Returns: {
          arrive_by: string | null
          created_at: string
          deleted_at: string | null
          depart_by: string | null
          destination_text: string
          driver_id: string | null
          event_id: string | null
          household_id: string
          id: string
          notes: string | null
          pickup_text: string
          requester_id: string
          state: Database["public"]["Enums"]["ride_state"]
          updated_at: string
          vehicle_label: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_poll: {
        Args: {
          p_decision: Json
          p_expected_version: number
          p_poll_id: string
        }
        Returns: {
          closed_at: string | null
          closes_at: string | null
          created_at: string
          creator_id: string
          decision_owner_id: string | null
          decision_rule: string
          deleted_at: string | null
          final_decision: Json | null
          household_id: string
          id: string
          options: Json
          question: string
          response_mode: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "polls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_household: {
        Args: { p_name: string; p_timezone?: string }
        Returns: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          name: string
          settings: Json
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "households"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      post_ride_update: {
        Args: { p_kind: string; p_note: string; p_ride_id: string }
        Returns: {
          author_id: string
          created_at: string
          household_id: string
          id: string
          kind: string
          note: string
          ride_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ride_updates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      kitchen_role:
        | "am_unload"
        | "pm_lead"
        | "pm_helper"
        | "pm_wipe"
        | "fridge"
      inventory_reason:
        | "purchased"
        | "counted"
        | "used"
        | "spoiled"
        | "scrapped"
        | "adjusted"
      announcement_state:
        | "draft"
        | "scheduled"
        | "active"
        | "expired"
        | "canceled"
      inventory_count_mode: "exact" | "approximate"
      inventory_level: "plenty" | "some" | "low" | "out" | "unknown"
      issue_state:
        | "reported"
        | "reviewing"
        | "monitoring"
        | "repair_planned"
        | "provider_contacted"
        | "scheduled"
        | "in_progress"
        | "resolved"
        | "closed"
      meal_response_state:
        | "home"
        | "later"
        | "away"
        | "save_plate"
        | "guest"
        | "unsure"
      member_role:
        | "admin"
        | "adult"
        | "teen"
        | "child"
        | "guest"
        | "caregiver"
        | "contractor"
      membership_state: "invited" | "active" | "suspended" | "expired" | "left"
      priority_level: "low" | "normal" | "high" | "urgent"
      request_state:
        | "new"
        | "seen"
        | "accepted"
        | "in_progress"
        | "waiting"
        | "completed"
        | "declined"
        | "canceled"
      ride_state:
        | "needed"
        | "offered"
        | "assigned"
        | "confirmed"
        | "completed"
        | "canceled"
      task_state:
        | "not_started"
        | "accepted"
        | "in_progress"
        | "waiting"
        | "blocked"
        | "completed"
        | "verified"
        | "skipped"
        | "canceled"
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
      announcement_state: [
        "draft",
        "scheduled",
        "active",
        "expired",
        "canceled",
      ],
      inventory_count_mode: ["exact", "approximate"],
      inventory_level: ["plenty", "some", "low", "out", "unknown"],
      kitchen_role: ["am_unload", "pm_lead", "pm_helper", "pm_wipe", "fridge"],
      issue_state: [
        "reported",
        "reviewing",
        "monitoring",
        "repair_planned",
        "provider_contacted",
        "scheduled",
        "in_progress",
        "resolved",
        "closed",
      ],
      meal_response_state: [
        "home",
        "later",
        "away",
        "save_plate",
        "guest",
        "unsure",
      ],
      member_role: [
        "admin",
        "adult",
        "teen",
        "child",
        "guest",
        "caregiver",
        "contractor",
      ],
      membership_state: ["invited", "active", "suspended", "expired", "left"],
      priority_level: ["low", "normal", "high", "urgent"],
      request_state: [
        "new",
        "seen",
        "accepted",
        "in_progress",
        "waiting",
        "completed",
        "declined",
        "canceled",
      ],
      ride_state: [
        "needed",
        "offered",
        "assigned",
        "confirmed",
        "completed",
        "canceled",
      ],
      task_state: [
        "not_started",
        "accepted",
        "in_progress",
        "waiting",
        "blocked",
        "completed",
        "verified",
        "skipped",
        "canceled",
      ],
    },
  },
} as const
