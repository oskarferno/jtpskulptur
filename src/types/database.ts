// Hand-authored to match supabase/migrations/0001_init_schema.sql.
// Once the JTP Supabase project exists, regenerate with:
//   npx supabase gen types typescript --project-id <jtp-project-ref> > src/types/database.ts

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          role: 'admin';
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & {
          id: string;
          display_name: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [];
      };
      media: {
        Row: {
          id: string;
          storage_path: string;
          alt_text: string | null;
          caption: string | null;
          width: number | null;
          height: number | null;
          mime_type: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['media']['Row']> & {
          storage_path: string;
        };
        Update: Partial<Database['public']['Tables']['media']['Row']>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          display_order: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['categories']['Row']> & {
          name: string;
          slug: string;
        };
        Update: Partial<Database['public']['Tables']['categories']['Row']>;
        Relationships: [];
      };
      artworks: {
        Row: {
          id: string;
          slug: string;
          title: string;
          year: number | null;
          description: string | null;
          material: string | null;
          dimensions: string | null;
          category_id: string | null;
          series: string | null;
          primary_image_id: string | null;
          display_order: number;
          featured: boolean;
          published: boolean;
          seo_title: string | null;
          seo_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['artworks']['Row']> & {
          slug: string;
          title: string;
        };
        Update: Partial<Database['public']['Tables']['artworks']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'artworks_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'artworks_primary_image_id_fkey';
            columns: ['primary_image_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
        ];
      };
      artwork_images: {
        Row: {
          id: string;
          artwork_id: string;
          media_id: string;
          caption: string | null;
          display_order: number;
        };
        Insert: Partial<Database['public']['Tables']['artwork_images']['Row']> & {
          artwork_id: string;
          media_id: string;
        };
        Update: Partial<Database['public']['Tables']['artwork_images']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'artwork_images_artwork_id_fkey';
            columns: ['artwork_id'];
            isOneToOne: false;
            referencedRelation: 'artworks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'artwork_images_media_id_fkey';
            columns: ['media_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
        ];
      };
      exhibitions: {
        Row: {
          id: string;
          title: string;
          venue: string | null;
          city: string | null;
          country: string | null;
          start_date: string | null;
          end_date: string | null;
          description: string | null;
          url: string | null;
          exhibition_type: string | null;
          published: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['exhibitions']['Row']> & {
          title: string;
        };
        Update: Partial<Database['public']['Tables']['exhibitions']['Row']>;
        Relationships: [];
      };
      exhibition_images: {
        Row: {
          id: string;
          exhibition_id: string;
          media_id: string;
          display_order: number;
        };
        Insert: Partial<Database['public']['Tables']['exhibition_images']['Row']> & {
          exhibition_id: string;
          media_id: string;
        };
        Update: Partial<Database['public']['Tables']['exhibition_images']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'exhibition_images_exhibition_id_fkey';
            columns: ['exhibition_id'];
            isOneToOne: false;
            referencedRelation: 'exhibitions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exhibition_images_media_id_fkey';
            columns: ['media_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
        ];
      };
      posts: {
        Row: {
          id: string;
          slug: string;
          title: string;
          excerpt: string | null;
          body: string | null;
          cover_media_id: string | null;
          published: boolean;
          published_at: string | null;
          seo_title: string | null;
          seo_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['posts']['Row']> & {
          slug: string;
          title: string;
        };
        Update: Partial<Database['public']['Tables']['posts']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'posts_cover_media_id_fkey';
            columns: ['cover_media_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
        ];
      };
      post_images: {
        Row: {
          id: string;
          post_id: string;
          media_id: string;
          display_order: number;
        };
        Insert: Partial<Database['public']['Tables']['post_images']['Row']> & {
          post_id: string;
          media_id: string;
        };
        Update: Partial<Database['public']['Tables']['post_images']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'post_images_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'post_images_media_id_fkey';
            columns: ['media_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
        ];
      };
      social_links: {
        Row: {
          id: string;
          platform: string;
          label: string;
          url: string;
          icon: string | null;
          display_order: number;
          published: boolean;
        };
        Insert: Partial<Database['public']['Tables']['social_links']['Row']> & {
          platform: string;
          label: string;
          url: string;
        };
        Update: Partial<Database['public']['Tables']['social_links']['Row']>;
        Relationships: [];
      };
      site_settings: {
        Row: {
          id: true;
          site_title: string;
          tagline: string | null;
          contact_email: string | null;
          phone: string | null;
          studio_location: string | null;
          contact_intro: string | null;
          contact_form_enabled: boolean;
          seo_default_title: string | null;
          seo_default_description: string | null;
          og_image_media_id: string | null;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['site_settings']['Row']>;
        Update: Partial<Database['public']['Tables']['site_settings']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'site_settings_og_image_media_id_fkey';
            columns: ['og_image_media_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
        ];
      };
      contact_messages: {
        Row: {
          id: string;
          name: string;
          email: string;
          subject: string | null;
          message: string;
          read: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['contact_messages']['Row']> & {
          name: string;
          email: string;
          message: string;
        };
        Update: Partial<Database['public']['Tables']['contact_messages']['Row']>;
        Relationships: [];
      };
      about_content: {
        Row: {
          id: true;
          artist_name: string | null;
          portrait_media_id: string | null;
          short_bio: string | null;
          full_bio: string | null;
          artist_statement: string | null;
          cv_media_id: string | null;
          education: unknown[];
          awards: unknown[];
          collections: unknown[];
          press: unknown[];
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['about_content']['Row']>;
        Update: Partial<Database['public']['Tables']['about_content']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'about_content_portrait_media_id_fkey';
            columns: ['portrait_media_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'about_content_cv_media_id_fkey';
            columns: ['cv_media_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
