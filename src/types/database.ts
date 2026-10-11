// Hand-authored to match supabase/migrations/0001_init_schema.sql.
// Once the JTP Supabase project exists, regenerate with:
//   npx supabase gen types typescript --project-id <jtp-project-ref> > src/types/database.ts

export type ShippingRegion = 'sweden' | 'denmark' | 'norway' | 'finland' | 'eu' | 'us' | 'row';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          role: 'admin' | 'vendor';
          vendor_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & {
          id: string;
          display_name: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'profiles_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      media: {
        Row: {
          id: string;
          storage_path: string;
          bucket: 'artwork-images' | 'site-media' | 'documents' | 'product-images';
          alt_text: string | null;
          caption: string | null;
          width: number | null;
          height: number | null;
          mime_type: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['media']['Row']> & {
          storage_path: string;
          bucket: 'artwork-images' | 'site-media' | 'documents' | 'product-images';
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
          hero_image_id: string | null;
          is_homepage_hero: boolean;
          hero_focal_x: number;
          hero_focal_y: number;
          display_order: number;
          featured_display_order: number | null;
          featured: boolean;
          published: boolean;
          seo_title: string | null;
          seo_description: string | null;
          availability: 'available' | 'sold' | 'not_for_sale';
          price: number | null;
          currency: string;
          inventory: number;
          sku: string | null;
          vendor_id: string | null;
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
          {
            foreignKeyName: 'artworks_hero_image_id_fkey';
            columns: ['hero_image_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'artworks_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
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
          slug: string | null;
          title: string;
          venue: string | null;
          city: string | null;
          country: string | null;
          start_date: string | null;
          end_date: string | null;
          intro: string | null;
          description: string | null;
          url: string | null;
          exhibition_type: string | null;
          cover_media_id: string | null;
          cover_focal_x: number;
          cover_focal_y: number;
          content_image_media_id: string | null;
          seo_title: string | null;
          seo_description: string | null;
          published: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['exhibitions']['Row']> & {
          title: string;
        };
        Update: Partial<Database['public']['Tables']['exhibitions']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'exhibitions_cover_media_id_fkey';
            columns: ['cover_media_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exhibitions_content_image_media_id_fkey';
            columns: ['content_image_media_id'];
            isOneToOne: false;
            referencedRelation: 'media';
            referencedColumns: ['id'];
          },
        ];
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
          hero_focal_x: number;
          hero_focal_y: number;
          content_image_media_id: string | null;
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
          {
            foreignKeyName: 'posts_content_image_media_id_fkey';
            columns: ['content_image_media_id'];
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
          contact_image_media_id: string | null;
          contact_image_focal_x: number;
          contact_image_focal_y: number;
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
          {
            foreignKeyName: 'site_settings_contact_image_media_id_fkey';
            columns: ['contact_image_media_id'];
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
          artwork_id: string | null;
          enquiry_type: 'general' | 'artwork';
        };
        Insert: Partial<Database['public']['Tables']['contact_messages']['Row']> & {
          name: string;
          email: string;
          message: string;
        };
        Update: Partial<Database['public']['Tables']['contact_messages']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'contact_messages_artwork_id_fkey';
            columns: ['artwork_id'];
            isOneToOne: false;
            referencedRelation: 'artworks';
            referencedColumns: ['id'];
          },
        ];
      };
      about_content: {
        Row: {
          id: true;
          artist_name: string | null;
          portrait_media_id: string | null;
          short_bio: string | null;
          full_bio: string | null;
          homepage_bio: string | null;
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
      vendors: {
        Row: {
          id: string;
          name: string;
          contact_email: string | null;
          notification_email: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['vendors']['Row']> & { name: string };
        Update: Partial<Database['public']['Tables']['vendors']['Row']>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          short_description: string | null;
          category: 'sculpture' | 'print' | 'book' | 'merchandise' | 'limited_edition' | 'other';
          price: number;
          currency: string;
          sku: string | null;
          inventory: number;
          active: boolean;
          featured: boolean;
          vendor_id: string | null;
          primary_image_id: string | null;
          seo_title: string | null;
          seo_description: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['products']['Row']> & {
          slug: string;
          name: string;
          price: number;
        };
        Update: Partial<Database['public']['Tables']['products']['Row']>;
        Relationships: [
          { foreignKeyName: 'products_vendor_id_fkey'; columns: ['vendor_id']; isOneToOne: false; referencedRelation: 'vendors'; referencedColumns: ['id'] },
          { foreignKeyName: 'products_primary_image_id_fkey'; columns: ['primary_image_id']; isOneToOne: false; referencedRelation: 'media'; referencedColumns: ['id'] },
        ];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          media_id: string;
          display_order: number;
        };
        Insert: Partial<Database['public']['Tables']['product_images']['Row']> & {
          product_id: string;
          media_id: string;
        };
        Update: Partial<Database['public']['Tables']['product_images']['Row']>;
        Relationships: [
          { foreignKeyName: 'product_images_product_id_fkey'; columns: ['product_id']; isOneToOne: false; referencedRelation: 'products'; referencedColumns: ['id'] },
          { foreignKeyName: 'product_images_media_id_fkey'; columns: ['media_id']; isOneToOne: false; referencedRelation: 'media'; referencedColumns: ['id'] },
        ];
      };
      shipping_rates: {
        Row: {
          id: string;
          region: ShippingRegion;
          label: string;
          price: number;
          currency: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['shipping_rates']['Row']> & {
          region: ShippingRegion;
          label: string;
          price: number;
        };
        Update: Partial<Database['public']['Tables']['shipping_rates']['Row']>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          customer_email: string;
          customer_name: string | null;
          subtotal: number;
          shipping: number;
          total: number;
          currency: string;
          payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'expired';
          fulfillment_status: 'awaiting_payment' | 'processing' | 'shipped' | 'cancelled' | 'address_review_required';
          shipping_region: ShippingRegion | null;
          shipping_address: Record<string, unknown> | null;
          shipping_address_status: 'ok' | 'review_required';
          reservation_expires_at: string | null;
          client_session_id: string | null;
          tracking_number: string | null;
          tracking_url: string | null;
          internal_note: string | null;
          paid_at: string | null;
          shipped_at: string | null;
          vendor_notified_at: string | null;
          shipping_email_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['orders']['Row']> & {
          order_number: string;
          customer_email: string;
        };
        Update: Partial<Database['public']['Tables']['orders']['Row']>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          artwork_id: string | null;
          vendor_id: string | null;
          product_name: string;
          sku: string | null;
          unit_price: number;
          quantity: number;
          image_path: string | null;
          shipped_at: string | null;
          tracking_number: string | null;
          tracking_url: string | null;
          shipped_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['order_items']['Row']> & {
          order_id: string;
          product_name: string;
          unit_price: number;
          quantity: number;
        };
        Update: Partial<Database['public']['Tables']['order_items']['Row']>;
        Relationships: [
          { foreignKeyName: 'order_items_order_id_fkey'; columns: ['order_id']; isOneToOne: false; referencedRelation: 'orders'; referencedColumns: ['id'] },
          { foreignKeyName: 'order_items_product_id_fkey'; columns: ['product_id']; isOneToOne: false; referencedRelation: 'products'; referencedColumns: ['id'] },
          { foreignKeyName: 'order_items_artwork_id_fkey'; columns: ['artwork_id']; isOneToOne: false; referencedRelation: 'artworks'; referencedColumns: ['id'] },
          { foreignKeyName: 'order_items_vendor_id_fkey'; columns: ['vendor_id']; isOneToOne: false; referencedRelation: 'vendors'; referencedColumns: ['id'] },
        ];
      };
      fulfillment_events: {
        Row: {
          id: string;
          order_id: string;
          event_type: string;
          performed_by: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['fulfillment_events']['Row']> & {
          order_id: string;
          event_type: string;
        };
        Update: Partial<Database['public']['Tables']['fulfillment_events']['Row']>;
        Relationships: [
          { foreignKeyName: 'fulfillment_events_order_id_fkey'; columns: ['order_id']; isOneToOne: false; referencedRelation: 'orders'; referencedColumns: ['id'] },
        ];
      };
      stripe_webhook_events: {
        Row: {
          id: string;
          type: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['stripe_webhook_events']['Row']> & {
          id: string;
          type: string;
        };
        Update: Partial<Database['public']['Tables']['stripe_webhook_events']['Row']>;
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          id: string;
          email: string;
          status: 'pending' | 'confirmed' | 'unsubscribed';
          confirm_token: string;
          unsubscribe_token: string;
          confirmed_at: string | null;
          unsubscribed_at: string | null;
          source: string | null;
          created_at: string;
          confirmation_sent_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['newsletter_subscribers']['Row']> & { email: string };
        Update: Partial<Database['public']['Tables']['newsletter_subscribers']['Row']>;
        Relationships: [];
      };
      newsletter_campaigns: {
        Row: {
          id: string;
          subject: string;
          content_markdown: string;
          status: 'draft' | 'sent';
          preview_text: string | null;
          primary_image_id: string | null;
          cta_text: string | null;
          cta_url: string | null;
          sent_at: string | null;
          recipient_count: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['newsletter_campaigns']['Row']> & {
          subject: string;
        };
        Update: Partial<Database['public']['Tables']['newsletter_campaigns']['Row']>;
        Relationships: [
          { foreignKeyName: 'newsletter_campaigns_primary_image_id_fkey'; columns: ['primary_image_id']; isOneToOne: false; referencedRelation: 'media'; referencedColumns: ['id'] },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      generate_order_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      try_reserve_product_inventory: {
        Args: { p_product_id: string; p_qty: number };
        Returns: boolean;
      };
      restore_product_inventory: {
        Args: { p_product_id: string; p_qty: number };
        Returns: undefined;
      };
      try_reserve_artwork_inventory: {
        Args: { p_artwork_id: string; p_qty: number };
        Returns: boolean;
      };
      restore_artwork_inventory: {
        Args: { p_artwork_id: string; p_qty: number };
        Returns: undefined;
      };
      sync_order_fulfillment_status: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      set_homepage_hero: {
        Args: { p_artwork_id: string };
        Returns: undefined;
      };
      reorder_artworks: {
        Args: { p_ids: string[]; p_kind: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
