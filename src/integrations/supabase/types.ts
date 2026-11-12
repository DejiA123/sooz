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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_feedback: {
        Row: {
          app_version: string | null
          comment: string | null
          created_at: string
          device: string | null
          id: string
          page: string | null
          rating: string
          resolved: boolean
          user_id: string
        }
        Insert: {
          app_version?: string | null
          comment?: string | null
          created_at?: string
          device?: string | null
          id?: string
          page?: string | null
          rating: string
          resolved?: boolean
          user_id?: string
        }
        Update: {
          app_version?: string | null
          comment?: string | null
          created_at?: string
          device?: string | null
          id?: string
          page?: string | null
          rating?: string
          resolved?: boolean
          user_id?: string
        }
        Relationships: []
      }
      app_moderators: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blocked_tiktoks: {
        Row: {
          created_at: string
          created_by: string | null
          key: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          key: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          key?: string
          reason?: string | null
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          hidden: boolean
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          hidden?: boolean
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          hidden?: boolean
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          archived: boolean
          cleared_at: string | null
          conversation_id: string
          delivered_at: string | null
          favourite: boolean
          hidden_at: string | null
          joined_at: string
          last_read_at: string | null
          marked_unread: boolean
          muted_until: string | null
          pinned_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          cleared_at?: string | null
          conversation_id: string
          delivered_at?: string | null
          favourite?: boolean
          hidden_at?: string | null
          joined_at?: string
          last_read_at?: string | null
          marked_unread?: boolean
          muted_until?: string | null
          pinned_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          cleared_at?: string | null
          conversation_id?: string
          delivered_at?: string | null
          favourite?: boolean
          hidden_at?: string | null
          joined_at?: string
          last_read_at?: string | null
          marked_unread?: boolean
          muted_until?: string | null
          pinned_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          disappear_seconds: number | null
          id: string
          name: string | null
          only_admins_edit: boolean
          only_admins_send: boolean
          type: Database["public"]["Enums"]["conversation_type"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          disappear_seconds?: number | null
          id?: string
          name?: string | null
          only_admins_edit?: boolean
          only_admins_send?: boolean
          type?: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          disappear_seconds?: number | null
          id?: string
          name?: string | null
          only_admins_edit?: boolean
          only_admins_send?: boolean
          type?: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          playback_url: string | null
          rtmp_url: string | null
          status: string | null
          stream_key: string | null
          stream_uid: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          playback_url?: string | null
          rtmp_url?: string | null
          status?: string | null
          stream_key?: string | null
          stream_uid?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          playback_url?: string | null
          rtmp_url?: string | null
          status?: string | null
          stream_key?: string | null
          stream_uid?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      message_hidden: {
        Row: {
          conversation_id: string
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          message_id: string
          user_id?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_hidden_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_hidden_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_hidden_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_pins: {
        Row: {
          conversation_id: string
          message_id: string
          pinned_at: string
          pinned_by: string
        }
        Insert: {
          conversation_id: string
          message_id: string
          pinned_at?: string
          pinned_by?: string
        }
        Update: {
          conversation_id?: string
          message_id?: string
          pinned_at?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_pins_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_pins_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_pins_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          conversation_id: string
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          emoji: string
          message_id: string
          user_id?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_stars: {
        Row: {
          conversation_id: string
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          message_id: string
          user_id?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_stars_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_stars_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_stars_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment: Json | null
          content: string
          conversation_id: string
          created_at: string
          edited_at: string | null
          expires_at: string | null
          forwarded: boolean
          id: string
          is_deleted: boolean | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          attachment?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          expires_at?: string | null
          forwarded?: boolean
          id?: string
          is_deleted?: boolean | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          attachment?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
          expires_at?: string | null
          forwarded?: boolean
          id?: string
          is_deleted?: boolean | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          content: string | null
          created_at: string
          id: string
          is_read: boolean | null
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          conversation_id: string
          message_id: string
          options: number[]
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          message_id: string
          options?: number[]
          updated_at?: string
          user_id?: string
        }
        Update: {
          conversation_id?: string
          message_id?: string
          options?: number[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          id: string
          post_id: string
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          created_at: string
          hidden: boolean
          id: string
          media_type: string | null
          media_url: string | null
          thumbnail_url: string | null
          user_id: string
          view_count: number | null
          views_count: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          hidden?: boolean
          id?: string
          media_type?: string | null
          media_url?: string | null
          thumbnail_url?: string | null
          user_id: string
          view_count?: number | null
          views_count?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          hidden?: boolean
          id?: string
          media_type?: string | null
          media_url?: string | null
          thumbnail_url?: string | null
          user_id?: string
          view_count?: number | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string
          website?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          snapshot: string | null
          status: string
          target_id: string
          target_owner: string | null
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          snapshot?: string | null
          status?: string
          target_id: string
          target_owner?: string | null
          target_type: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          snapshot?: string | null
          status?: string
          target_id?: string
          target_owner?: string | null
          target_type?: string
        }
        Relationships: []
      }
      reposts: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          tiktok: Json | null
          tiktok_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          tiktok?: Json | null
          tiktok_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          tiktok?: Json | null
          tiktok_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reposts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type: string
          media_url: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_comments: {
        Row: {
          content: string
          created_at: string
          hidden: boolean
          id: string
          parent_id: string | null
          tiktok_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          hidden?: boolean
          id?: string
          parent_id?: string | null
          tiktok_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          hidden?: boolean
          id?: string
          parent_id?: string | null
          tiktok_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tiktok_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_curators: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_curators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_trusted_creators: {
        Row: {
          added_by: string | null
          created_at: string
          handle: string
          note: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          handle: string
          note?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          handle?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_trusted_creators_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_videos: {
        Row: {
          author_handle: string | null
          author_name: string | null
          author_url: string | null
          created_at: string
          faith_tags: string[]
          id: string
          metadata_refreshed_at: string
          review_note: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string | null
          thumbnail_height: number | null
          thumbnail_url: string | null
          thumbnail_width: number | null
          tiktok_id: string
          title: string | null
          updated_at: string
          url: string
        }
        Insert: {
          author_handle?: string | null
          author_name?: string | null
          author_url?: string | null
          created_at?: string
          faith_tags?: string[]
          id?: string
          metadata_refreshed_at?: string
          review_note?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          thumbnail_height?: number | null
          thumbnail_url?: string | null
          thumbnail_width?: number | null
          tiktok_id: string
          title?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          author_handle?: string | null
          author_name?: string | null
          author_url?: string | null
          created_at?: string
          faith_tags?: string[]
          id?: string
          metadata_refreshed_at?: string
          review_note?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          thumbnail_height?: number | null
          thumbnail_url?: string | null
          thumbnail_width?: number | null
          tiktok_id?: string
          title?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_videos_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_videos_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id?: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          family_pin_hash: string | null
          family_safe: boolean
          taste: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          family_pin_hash?: string | null
          family_safe?: boolean
          taste?: Json | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          family_pin_hash?: string | null
          family_safe?: boolean
          taste?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_archive: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          download_attempts: number | null
          duration: string | null
          id: string
          is_featured: boolean | null
          published_at: string | null
          r2_video_url: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          view_count: number | null
          youtube_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          download_attempts?: number | null
          duration?: string | null
          id?: string
          is_featured?: boolean | null
          published_at?: string | null
          r2_video_url?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          view_count?: number | null
          youtube_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          download_attempts?: number | null
          duration?: string | null
          id?: string
          is_featured?: boolean | null
          published_at?: string | null
          r2_video_url?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
          youtube_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      post_share_counts: {
        Row: {
          post_id: string | null
          shares: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      repost_counts: {
        Row: {
          reposts: number | null
          target: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_delete_message: {
        Args: { target_message_id: string }
        Returns: undefined
      }
      can_send_in: {
        Args: { target_conversation_id: string }
        Returns: boolean
      }
      chat_blocked: {
        Args: { target_conversation_id: string }
        Returns: boolean
      }
      get_email_by_username: {
        Args: { username_input: string }
        Returns: string
      }
      get_or_create_direct_chat: {
        Args: { other_user: string }
        Returns: string
      }
      increment_view_count: {
        Args: { post_id_param: string }
        Returns: undefined
      }
      is_chat_admin: {
        Args: { target_conversation_id: string }
        Returns: boolean
      }
      is_chat_member: {
        Args: { target_conversation_id: string }
        Returns: boolean
      }
      is_conversation_creator: {
        Args: { target_conversation_id: string }
        Returns: boolean
      }
      is_moderator: { Args: never; Returns: boolean }
      is_tiktok_curator: { Args: { uid: string }; Returns: boolean }
      mark_chats_delivered: { Args: never; Returns: undefined }
      message_in_chat: {
        Args: { target_conversation_id: string; target_message_id: string }
        Returns: boolean
      }
      moderate: {
        Args: { p_action: string; p_id: string; p_type: string }
        Returns: undefined
      }
      my_chat_list: {
        Args: never
        Returns: {
          archived: boolean
          avatar_url: string
          cleared_at: string
          created_at: string
          disappear_seconds: number
          favourite: boolean
          hidden_at: string
          id: string
          last_attachment: Json
          last_content: string
          last_created_at: string
          last_is_deleted: boolean
          last_message_id: string
          last_read_at: string
          last_sender_id: string
          last_sender_name: string
          marked_unread: boolean
          member_count: number
          muted_until: string
          name: string
          other_avatar_url: string
          other_display_name: string
          other_updated_at: string
          other_user_id: string
          other_username: string
          others_delivered_at: string
          others_read_at: string
          pinned_at: string
          type: string
          unread: number
        }[]
      }
      reported_items: {
        Args: never
        Returns: {
          target_id: string
          target_type: string
        }[]
      }
      set_chat_role: {
        Args: {
          member_id: string
          new_role: string
          target_conversation_id: string
        }
        Returns: undefined
      }
      trusted_creator_handles: {
        Args: never
        Returns: {
          handle: string
        }[]
      }
    }
    Enums: {
      conversation_type: "direct" | "group"
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
      conversation_type: ["direct", "group"],
    },
  },
} as const
