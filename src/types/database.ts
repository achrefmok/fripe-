
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "account_deletions": {
                  Row: {
                    "attempts": number,"completed_at": string | null,"requested_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"completed_at"?: string | null,"requested_at"?: string,"user_id": string
                  }
                  Update: {
                    "attempts"?: number,"completed_at"?: string | null,"requested_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": number,"metadata": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: never,"metadata"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"metadata"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"cart_items": {
                  Row: {
                    "created_at": string,"product_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"product_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"product_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_references"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "cart_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name_ar": string,"name_fr": string,"parent_id": string | null,"position": number,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name_ar": string,"name_fr": string,"parent_id"?: string | null,"position"?: number,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name_ar"?: string,"name_fr"?: string,"parent_id"?: string | null,"position"?: number,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"cities": {
                  Row: {
                    "governorate_id": number,"id": number,"is_active": boolean,"name_ar": string,"name_fr": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "governorate_id": number,"id"?: never,"is_active"?: boolean,"name_ar": string,"name_fr": string,"slug": string
                  }
                  Update: {
                    "governorate_id"?: number,"id"?: never,"is_active"?: boolean,"name_ar"?: string,"name_fr"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cities_governorate_id_fkey"
      columns: ["governorate_id"]
isOneToOne: false
      referencedRelation: "governorates"
      referencedColumns: ["id"]
    }
                  ]
                },"collection_products": {
                  Row: {
                    "collection_id": string,"position": number,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "collection_id": string,"position"?: number,"product_id": string
                  }
                  Update: {
                    "collection_id"?: string,"position"?: number,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "collection_products_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "collections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collection_products_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_references"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "collection_products_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"collections": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_published": boolean,"name": string,"shop_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_published"?: boolean,"name": string,"shop_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_published"?: boolean,"name"?: string,"shop_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "collections_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_participants": {
                  Row: {
                    "conversation_id": string,"last_read_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"last_read_at"?: string,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"last_read_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_participants_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "client_id": string | null,"client_name": string,"closed_at": string | null,"created_at": string,"id": string,"last_message_at": string,"shop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id"?: string | null,"client_name": string,"closed_at"?: string | null,"created_at"?: string,"id"?: string,"last_message_at"?: string,"shop_id": string
                  }
                  Update: {
                    "client_id"?: string | null,"client_name"?: string,"closed_at"?: string | null,"created_at"?: string,"id"?: string,"last_message_at"?: string,"shop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_rates": {
                  Row: {
                    "fee_millimes": number,"governorate_id": number | null,"id": string,"shop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fee_millimes": number,"governorate_id"?: number | null,"id"?: string,"shop_id": string
                  }
                  Update: {
                    "fee_millimes"?: number,"governorate_id"?: number | null,"id"?: string,"shop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "delivery_rates_governorate_id_fkey"
      columns: ["governorate_id"]
isOneToOne: false
      referencedRelation: "governorates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delivery_rates_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"drop_alerts": {
                  Row: {
                    "brands": (string)[],"category_ids": (string)[],"created_at": string,"followed_only": boolean,"id": string,"is_active": boolean,"max_price_millimes": number | null,"name": string,"shop_ids": (string)[],"sizes": (string)[],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brands"?: (string)[],"category_ids"?: (string)[],"created_at"?: string,"followed_only"?: boolean,"id"?: string,"is_active"?: boolean,"max_price_millimes"?: number | null,"name": string,"shop_ids"?: (string)[],"sizes"?: (string)[],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "brands"?: (string)[],"category_ids"?: (string)[],"created_at"?: string,"followed_only"?: boolean,"id"?: string,"is_active"?: boolean,"max_price_millimes"?: number | null,"name"?: string,"shop_ids"?: (string)[],"sizes"?: (string)[],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "drop_alerts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"product_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"product_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"product_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_references"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "favorites_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"governorates": {
                  Row: {
                    "id": number,"name_ar": string,"name_fr": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"name_ar": string,"name_fr": string,"slug": string
                  }
                  Update: {
                    "id"?: never,"name_ar"?: string,"name_fr"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"inventory_items": {
                  Row: {
                    "approx_quantity": number,"category_id": string,"created_at": string,"id": string,"is_visible": boolean,"label": string | null,"last_counted_at": string,"shop_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approx_quantity": number,"category_id": string,"created_at"?: string,"id"?: string,"is_visible"?: boolean,"label"?: string | null,"last_counted_at"?: string,"shop_id": string,"updated_at"?: string
                  }
                  Update: {
                    "approx_quantity"?: number,"category_id"?: string,"created_at"?: string,"id"?: string,"is_visible"?: boolean,"label"?: string | null,"last_counted_at"?: string,"shop_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_items_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_items_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_movements": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"id": number,"item_id": string,"new_quantity": number,"previous_quantity": number | null,"shop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: never,"item_id": string,"new_quantity": number,"previous_quantity"?: number | null,"shop_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: never,"item_id"?: string,"new_quantity"?: number,"previous_quantity"?: number | null,"shop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_movements_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"maintenance_runs": {
                  Row: {
                    "error": string | null,"finished_at": string | null,"id": string,"result": Json | null,"started_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"finished_at"?: string | null,"id"?: string,"result"?: Json | null,"started_at"?: string,"status"?: string
                  }
                  Update: {
                    "error"?: string | null,"finished_at"?: string | null,"id"?: string,"result"?: Json | null,"started_at"?: string,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"messages": {
                  Row: {
                    "body": string,"conversation_id": string,"created_at": string,"id": string,"product_id": string | null,"sender_id": string | null,"sender_side": Database["public"]['Enums']["message_side"],"stock_request_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"conversation_id": string,"created_at"?: string,"id"?: string,"product_id"?: string | null,"sender_id"?: string | null,"sender_side": Database["public"]['Enums']["message_side"],"stock_request_id"?: string | null
                  }
                  Update: {
                    "body"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"product_id"?: string | null,"sender_id"?: string | null,"sender_side"?: Database["public"]['Enums']["message_side"],"stock_request_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_references"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "messages_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_stock_request_id_fkey"
      columns: ["stock_request_id"]
isOneToOne: false
      referencedRelation: "stock_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "in_app_enabled": boolean,"max_per_day": number,"push_enabled": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "in_app_enabled"?: boolean,"max_per_day"?: number,"push_enabled"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "in_app_enabled"?: boolean,"max_per_day"?: number,"push_enabled"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "alert_id": string | null,"created_at": string,"id": string,"kind": string,"product_id": string | null,"read_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_id"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"product_id"?: string | null,"read_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "alert_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"product_id"?: string | null,"read_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_alert_id_fkey"
      columns: ["alert_id"]
isOneToOne: false
      referencedRelation: "drop_alerts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_references"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "notifications_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"order_groups": {
                  Row: {
                    "address_line": string | null,"city_id": number | null,"client_id": string | null,"created_at": string,"governorate_id": number | null,"id": string,"payment_method": string,"phone": string | null,"recipient_name": string,"reference": string,"total_millimes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line"?: string | null,"city_id"?: number | null,"client_id"?: string | null,"created_at"?: string,"governorate_id"?: number | null,"id"?: string,"payment_method"?: string,"phone"?: string | null,"recipient_name": string,"reference": string,"total_millimes"?: number
                  }
                  Update: {
                    "address_line"?: string | null,"city_id"?: number | null,"client_id"?: string | null,"created_at"?: string,"governorate_id"?: number | null,"id"?: string,"payment_method"?: string,"phone"?: string | null,"recipient_name"?: string,"reference"?: string,"total_millimes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_groups_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_groups_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_groups_governorate_id_fkey"
      columns: ["governorate_id"]
isOneToOne: false
      referencedRelation: "governorates"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "brand": string | null,"condition": Database["public"]['Enums']["product_condition"] | null,"created_at": string,"id": string,"image_path": string | null,"is_live": boolean,"order_id": string,"price_millimes": number,"product_id": string,"reference": string,"size": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"condition"?: Database["public"]['Enums']["product_condition"] | null,"created_at"?: string,"id"?: string,"image_path"?: string | null,"is_live"?: boolean,"order_id": string,"price_millimes": number,"product_id": string,"reference": string,"size"?: string | null,"title": string
                  }
                  Update: {
                    "brand"?: string | null,"condition"?: Database["public"]['Enums']["product_condition"] | null,"created_at"?: string,"id"?: string,"image_path"?: string | null,"is_live"?: boolean,"order_id"?: string,"price_millimes"?: number,"product_id"?: string,"reference"?: string,"size"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_references"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"client_id": string | null,"confirmed_at": string | null,"created_at": string,"delivered_at": string | null,"delivery_fee_millimes": number,"fulfillment": Database["public"]['Enums']["fulfillment_method"],"group_id": string,"id": string,"shipped_at": string | null,"shop_id": string,"status": Database["public"]['Enums']["order_status"],"subtotal_millimes": number,"total_millimes": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_id"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"delivered_at"?: string | null,"delivery_fee_millimes"?: number,"fulfillment": Database["public"]['Enums']["fulfillment_method"],"group_id": string,"id"?: string,"shipped_at"?: string | null,"shop_id": string,"status"?: Database["public"]['Enums']["order_status"],"subtotal_millimes": number,"total_millimes": number,"updated_at"?: string
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_id"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"delivered_at"?: string | null,"delivery_fee_millimes"?: number,"fulfillment"?: Database["public"]['Enums']["fulfillment_method"],"group_id"?: string,"id"?: string,"shipped_at"?: string | null,"shop_id"?: string,"status"?: Database["public"]['Enums']["order_status"],"subtotal_millimes"?: number,"total_millimes"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "order_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"outfit_items": {
                  Row: {
                    "outfit_id": string,"product_id": string,"slot": Database["public"]['Enums']["outfit_slot"]
                  }
                  ComputedFields: never
                  Insert: {
                    "outfit_id": string,"product_id": string,"slot": Database["public"]['Enums']["outfit_slot"]
                  }
                  Update: {
                    "outfit_id"?: string,"product_id"?: string,"slot"?: Database["public"]['Enums']["outfit_slot"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "outfit_items_outfit_id_fkey"
      columns: ["outfit_id"]
isOneToOne: false
      referencedRelation: "outfits"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outfit_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_references"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "outfit_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"outfits": {
                  Row: {
                    "budget_millimes": number | null,"created_at": string,"id": string,"is_public": boolean,"name": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "budget_millimes"?: number | null,"created_at"?: string,"id"?: string,"is_public"?: boolean,"name": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "budget_millimes"?: number | null,"created_at"?: string,"id"?: string,"is_public"?: boolean,"name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "outfits_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_admins_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_settings": {
                  Row: {
                    "description": string,"key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string,"key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"product_images": {
                  Row: {
                    "created_at": string,"id": string,"path": string,"position": number,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"path": string,"position"?: number,"product_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"path"?: string,"position"?: number,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_references"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "brand": string | null,"category_id": string | null,"color": string | null,"condition": Database["public"]['Enums']["product_condition"] | null,"created_at": string,"defects": string | null,"description": string | null,"favorite_count": number,"id": string,"moderated_at": string | null,"price_millimes": number | null,"publication_status": Database["public"]['Enums']["publication_status"],"published_at": string | null,"reference": string,"search_text": string,"shop_id": string,"size": string | null,"status": Database["public"]['Enums']["product_status"],"title": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"category_id"?: string | null,"color"?: string | null,"condition"?: Database["public"]['Enums']["product_condition"] | null,"created_at"?: string,"defects"?: string | null,"description"?: string | null,"favorite_count"?: number,"id"?: string,"moderated_at"?: string | null,"price_millimes"?: number | null,"publication_status"?: Database["public"]['Enums']["publication_status"],"published_at"?: string | null,"reference": string,"search_text"?: string,"shop_id": string,"size"?: string | null,"status"?: Database["public"]['Enums']["product_status"],"title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "brand"?: string | null,"category_id"?: string | null,"color"?: string | null,"condition"?: Database["public"]['Enums']["product_condition"] | null,"created_at"?: string,"defects"?: string | null,"description"?: string | null,"favorite_count"?: number,"id"?: string,"moderated_at"?: string | null,"price_millimes"?: number | null,"publication_status"?: Database["public"]['Enums']["publication_status"],"published_at"?: string | null,"reference"?: string,"search_text"?: string,"shop_id"?: string,"size"?: string | null,"status"?: Database["public"]['Enums']["product_status"],"title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"display_name": string,"id": string,"locale": Database["public"]['Enums']["app_locale"],"phone": string | null,"status": Database["public"]['Enums']["account_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"display_name": string,"id": string,"locale"?: Database["public"]['Enums']["app_locale"],"phone"?: string | null,"status"?: Database["public"]['Enums']["account_status"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"locale"?: Database["public"]['Enums']["app_locale"],"phone"?: string | null,"status"?: Database["public"]['Enums']["account_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "action": string,"hits": number,"user_id": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"hits"?: number,"user_id": string,"window_start": string
                  }
                  Update: {
                    "action"?: string,"hits"?: number,"user_id"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"report_decisions": {
                  Row: {
                    "admin_id": string | null,"created_at": string,"decision": Database["public"]['Enums']["report_decision"],"id": number,"note": string,"report_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_id"?: string | null,"created_at"?: string,"decision": Database["public"]['Enums']["report_decision"],"id"?: never,"note": string,"report_id": string
                  }
                  Update: {
                    "admin_id"?: string | null,"created_at"?: string,"decision"?: Database["public"]['Enums']["report_decision"],"id"?: never,"note"?: string,"report_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_decisions_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"details": string | null,"id": string,"reason": string,"reporter_id": string | null,"snapshot": NonNullable<Json>,"status": Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason": string,"reporter_id"?: string | null,"snapshot"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"id"?: string,"reason"?: string,"reporter_id"?: string | null,"snapshot"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reservations": {
                  Row: {
                    "client_id": string | null,"created_at": string,"expires_at": string,"id": string,"product_id": string,"shop_id": string,"status": Database["public"]['Enums']["reservation_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id"?: string | null,"created_at"?: string,"expires_at": string,"id"?: string,"product_id": string,"shop_id": string,"status"?: Database["public"]['Enums']["reservation_status"],"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string | null,"created_at"?: string,"expires_at"?: string,"id"?: string,"product_id"?: string,"shop_id"?: string,"status"?: Database["public"]['Enums']["reservation_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reservations_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservations_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_references"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "reservations_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservations_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "author_name": string,"client_id": string | null,"comment": string | null,"created_at": string,"id": string,"order_item_id": string,"product_title": string,"rating": number,"replied_at": string | null,"seller_reply": string | null,"shop_id": string,"status": Database["public"]['Enums']["review_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "author_name": string,"client_id"?: string | null,"comment"?: string | null,"created_at"?: string,"id"?: string,"order_item_id": string,"product_title": string,"rating": number,"replied_at"?: string | null,"seller_reply"?: string | null,"shop_id": string,"status"?: Database["public"]['Enums']["review_status"]
                  }
                  Update: {
                    "author_name"?: string,"client_id"?: string | null,"comment"?: string | null,"created_at"?: string,"id"?: string,"order_item_id"?: string,"product_title"?: string,"rating"?: number,"replied_at"?: string | null,"seller_reply"?: string | null,"shop_id"?: string,"status"?: Database["public"]['Enums']["review_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_order_item_id_fkey"
      columns: ["order_item_id"]
isOneToOne: true
      referencedRelation: "order_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"shop_addresses": {
                  Row: {
                    "address_line": string,"city_id": number,"created_at": string,"governorate_id": number,"id": string,"is_primary": boolean,"label": string,"latitude": number | null,"longitude": number | null,"shop_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line": string,"city_id": number,"created_at"?: string,"governorate_id": number,"id"?: string,"is_primary"?: boolean,"label": string,"latitude"?: number | null,"longitude"?: number | null,"shop_id": string,"updated_at"?: string
                  }
                  Update: {
                    "address_line"?: string,"city_id"?: number,"created_at"?: string,"governorate_id"?: number,"id"?: string,"is_primary"?: boolean,"label"?: string,"latitude"?: number | null,"longitude"?: number | null,"shop_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_addresses_governorate_id_city_id_fkey"
      columns: ["governorate_id","city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["governorate_id","id"]
    },{
      foreignKeyName: "shop_addresses_governorate_id_fkey"
      columns: ["governorate_id"]
isOneToOne: false
      referencedRelation: "governorates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shop_addresses_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"shop_followers": {
                  Row: {
                    "created_at": string,"shop_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"shop_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"shop_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_followers_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shop_followers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"shop_members": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["shop_role"],"shop_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role": Database["public"]['Enums']["shop_role"],"shop_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["shop_role"],"shop_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_members_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shop_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"shops": {
                  Row: {
                    "approved_at": string | null,"city_id": number,"cover_path": string | null,"created_at": string,"description": string | null,"follower_count": number,"governorate_id": number,"id": string,"logo_path": string | null,"name": string,"phone": string | null,"plan": Database["public"]['Enums']["shop_plan"],"rating_count": number,"rating_sum": number,"review_note": string | null,"slug": string,"status": Database["public"]['Enums']["shop_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"city_id": number,"cover_path"?: string | null,"created_at"?: string,"description"?: string | null,"follower_count"?: number,"governorate_id": number,"id"?: string,"logo_path"?: string | null,"name": string,"phone"?: string | null,"plan"?: Database["public"]['Enums']["shop_plan"],"rating_count"?: number,"rating_sum"?: number,"review_note"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["shop_status"],"updated_at"?: string
                  }
                  Update: {
                    "approved_at"?: string | null,"city_id"?: number,"cover_path"?: string | null,"created_at"?: string,"description"?: string | null,"follower_count"?: number,"governorate_id"?: number,"id"?: string,"logo_path"?: string | null,"name"?: string,"phone"?: string | null,"plan"?: Database["public"]['Enums']["shop_plan"],"rating_count"?: number,"rating_sum"?: number,"review_note"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["shop_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shops_governorate_id_city_id_fkey"
      columns: ["governorate_id","city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["governorate_id","id"]
    },{
      foreignKeyName: "shops_governorate_id_fkey"
      columns: ["governorate_id"]
isOneToOne: false
      referencedRelation: "governorates"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_request_offers": {
                  Row: {
                    "created_at": string,"id": string,"message": string | null,"product_id": string,"request_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"message"?: string | null,"product_id": string,"request_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"message"?: string | null,"product_id"?: string,"request_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_request_offers_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_references"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "stock_request_offers_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_request_offers_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "stock_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_requests": {
                  Row: {
                    "brand": string | null,"budget_millimes": number | null,"category_id": string | null,"client_id": string | null,"client_name": string,"color": string | null,"created_at": string,"id": string,"message": string,"shop_id": string,"size": string | null,"status": Database["public"]['Enums']["stock_request_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"budget_millimes"?: number | null,"category_id"?: string | null,"client_id"?: string | null,"client_name": string,"color"?: string | null,"created_at"?: string,"id"?: string,"message": string,"shop_id": string,"size"?: string | null,"status"?: Database["public"]['Enums']["stock_request_status"],"updated_at"?: string
                  }
                  Update: {
                    "brand"?: string | null,"budget_millimes"?: number | null,"category_id"?: string | null,"client_id"?: string | null,"client_name"?: string,"color"?: string | null,"created_at"?: string,"id"?: string,"message"?: string,"shop_id"?: string,"size"?: string | null,"status"?: Database["public"]['Enums']["stock_request_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_requests_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_requests_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"storage_purge_queue": {
                  Row: {
                    "attempts": number,"bucket": string,"created_at": string,"done_at": string | null,"id": number,"outcome": string | null,"path": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"bucket": string,"created_at"?: string,"done_at"?: string | null,"id"?: never,"outcome"?: string | null,"path": string,"reason": string
                  }
                  Update: {
                    "attempts"?: number,"bucket"?: string,"created_at"?: string,"done_at"?: string | null,"id"?: never,"outcome"?: string | null,"path"?: string,"reason"?: string
                  }
                  Relationships: [
                    
                  ]
                },"style_preferences": {
                  Row: {
                    "budget_millimes": number | null,"colors": (string)[],"occasion": string | null,"shoe_size": string | null,"size": string | null,"style": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "budget_millimes"?: number | null,"colors"?: (string)[],"occasion"?: string | null,"shoe_size"?: string | null,"size"?: string | null,"style"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "budget_millimes"?: number | null,"colors"?: (string)[],"occasion"?: string | null,"shoe_size"?: string | null,"size"?: string | null,"style"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "style_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_blocks": {
                  Row: {
                    "blocked_by": Database["public"]['Enums']["block_side"],"client_id": string,"client_name": string | null,"created_at": string,"shop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_by": Database["public"]['Enums']["block_side"],"client_id": string,"client_name"?: string | null,"created_at"?: string,"shop_id": string
                  }
                  Update: {
                    "blocked_by"?: Database["public"]['Enums']["block_side"],"client_id"?: string,"client_name"?: string | null,"created_at"?: string,"shop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_blocks_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"video_favorites": {
                  Row: {
                    "created_at": string,"user_id": string,"video_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string,"video_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string,"video_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_favorites_video_id_fkey"
      columns: ["video_id"]
isOneToOne: false
      referencedRelation: "videos"
      referencedColumns: ["id"]
    }
                  ]
                },"video_products": {
                  Row: {
                    "position": number,"product_id": string,"video_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "position"?: number,"product_id": string,"video_id": string
                  }
                  Update: {
                    "position"?: number,"product_id"?: string,"video_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_products_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_references"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "video_products_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_products_video_id_fkey"
      columns: ["video_id"]
isOneToOne: false
      referencedRelation: "videos"
      referencedColumns: ["id"]
    }
                  ]
                },"videos": {
                  Row: {
                    "created_at": string,"description": string | null,"duration_seconds": number | null,"favorite_count": number,"height": number | null,"id": string,"moderated_at": string | null,"published_at": string | null,"shop_id": string,"size_bytes": number | null,"status": Database["public"]['Enums']["video_status"],"thumbnail_path": string | null,"updated_at": string,"video_path": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"duration_seconds"?: number | null,"favorite_count"?: number,"height"?: number | null,"id"?: string,"moderated_at"?: string | null,"published_at"?: string | null,"shop_id": string,"size_bytes"?: number | null,"status"?: Database["public"]['Enums']["video_status"],"thumbnail_path"?: string | null,"updated_at"?: string,"video_path"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"duration_seconds"?: number | null,"favorite_count"?: number,"height"?: number | null,"id"?: string,"moderated_at"?: string | null,"published_at"?: string | null,"shop_id"?: string,"size_bytes"?: number | null,"status"?: Database["public"]['Enums']["video_status"],"thumbnail_path"?: string | null,"updated_at"?: string,"video_path"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "videos_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "my_reviews": {
                  Row: {
                    "comment": string | null,"created_at": string,"id": string,"order_item_id": string,"rating": number,"seller_reply": string | null,"status": Database["public"]['Enums']["review_status"]
                  }
                  ComputedFields: never
                  Insert: {
                           "comment"?: string | null,"created_at"?: string | null,"id"?: string | null,"order_item_id"?: string | null,"rating"?: number | null,"seller_reply"?: string | null,"status"?: Database["public"]['Enums']["review_status"] | null
                         }
                        Update: {
                           "comment"?: string | null,"created_at"?: string | null,"id"?: string | null,"order_item_id"?: string | null,"rating"?: number | null,"seller_reply"?: string | null,"status"?: Database["public"]['Enums']["review_status"] | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "reviews_order_item_id_fkey"
      columns: ["order_item_id"]
isOneToOne: true
      referencedRelation: "order_items"
      referencedColumns: ["id"]
    }
                  ]
                },"product_references": {
                  Row: {
                    "product_id": string,"reference": string,"shop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "product_id"?: string | null,"reference"?: string | null,"shop_id"?: string | null
                         }
                        Update: {
                           "product_id"?: string | null,"reference"?: string | null,"shop_id"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "products_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_list_users":
{ Args: { "p_limit": number,"p_offset": number,"p_search": string }; Returns: {
              "created_at": string,"display_name": string,"email": string,"id": string,"is_admin": boolean,"phone": string,"shop_count": number,"status": Database["public"]['Enums']["account_status"],"total_count": number
            }[]
                           },
"begin_maintenance_run":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"block_client":
{ Args: { "p_block": boolean,"p_client_id": string,"p_shop_id": string }; Returns: undefined
                           },
"block_conversation":
{ Args: { "p_block": boolean,"p_conversation_id": string }; Returns: undefined
                           },
"block_shop":
{ Args: { "p_block": boolean,"p_shop_id": string }; Returns: undefined
                           },
"cancel_order":
{ Args: { "p_order_id": string,"p_reason": string }; Returns: undefined
                           },
"cancel_reservation":
{ Args: { "p_reservation_id": string }; Returns: undefined
                           },
"close_stock_request":
{ Args: { "p_request_id": string }; Returns: undefined
                           },
"contact_request_client":
{ Args: { "p_body": string,"p_request_id": string }; Returns: string
                           },
"create_report":
{ Args: { "p_details": string,"p_reason": string,"p_target_id": string,"p_target_type": Database["public"]['Enums']["report_target"] }; Returns: string
                           },
"create_review":
{ Args: { "p_comment": string,"p_order_item_id": string,"p_rating": number }; Returns: string
                           },
"create_shop":
{ Args: { "p_city_id": number,"p_description": string,"p_governorate_id": number,"p_name": string,"p_phone": string,"p_slug": string }; Returns: string
                           },
"create_stock_request":
{ Args: { "p_brand": string,"p_budget_millimes": number,"p_category_id": string,"p_color": string,"p_message": string,"p_shop_id": string,"p_size": string }; Returns: string
                           },
"create_video_draft":
{ Args: { "p_description": string,"p_shop_id": string }; Returns: string
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"delivery_quote":
{ Args: { "p_governorate_id": number,"p_shop_ids": (string)[] }; Returns: {
              "fee_millimes": number,"shop_id": string
            }[]
                           },
"emergency_takedown":
{ Args: { "p_reason": string,"p_shop_id": string }; Returns: undefined
                           },
"finalize_video":
{ Args: { "p_duration_seconds": number,"p_height": number,"p_thumbnail_path": string,"p_video_id": string,"p_video_path": string,"p_width": number }; Returns: undefined
                           },
"finish_maintenance_run":
{ Args: { "p_error": string,"p_result": Json,"p_run": string,"p_status": string }; Returns: undefined
                           },
"log_mfa_event":
{ Args: { "p_action": string }; Returns: undefined
                           },
"mark_conversation_read":
{ Args: { "p_conversation_id": string }; Returns: undefined
                           },
"moderate_product":
{ Args: { "p_product_id": string,"p_reason": string }; Returns: undefined
                           },
"moderate_review":
{ Args: { "p_note": string,"p_review_id": string,"p_status": Database["public"]['Enums']["review_status"] }; Returns: undefined
                           },
"moderate_video":
{ Args: { "p_reason": string,"p_video_id": string }; Returns: undefined
                           },
"my_conversations":
{ Args: Record<PropertyKey, never>; Returns: {
              "client_id": string,"client_name": string,"closed_at": string,"id": string,"last_body": string,"last_message_at": string,"shop_id": string,"shop_name": string,"unread": number
            }[]
                           },
"next_storage_purge":
{ Args: { "p_limit": number }; Returns: {
              "attempts": number,"bucket": string,"id": number,"path": string
            }[]
                           },
"offer_product":
{ Args: { "p_message": string,"p_product_id": string,"p_request_id": string }; Returns: undefined
                           },
"place_order":
{ Args: { "p_address_line": string,"p_city_id": number,"p_expected_total"?: number,"p_governorate_id": number,"p_phone": string,"p_pickup_shop_ids": (string)[],"p_product_ids": (string)[],"p_recipient_name": string }; Returns: string
                           },
"reply_review":
{ Args: { "p_reply": string,"p_review_id": string }; Returns: undefined
                           },
"reservation_ttl_minutes":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"reserve_product":
{ Args: { "p_product_id": string }; Returns: string
                           },
"reset_admin_access":
{ Args: { "p_operator": string,"p_reason": string,"p_user_id": string }; Returns: undefined
                           },
"resubmit_shop":
{ Args: { "p_shop_id": string }; Returns: undefined
                           },
"review_report":
{ Args: { "p_decision": Database["public"]['Enums']["report_decision"],"p_note": string,"p_report_id": string }; Returns: undefined
                           },
"review_shop":
{ Args: { "p_note": string,"p_shop_id": string,"p_status": Database["public"]['Enums']["shop_status"] }; Returns: undefined
                           },
"save_delivery_rates":
{ Args: { "p_default_fee": number,"p_overrides": Json,"p_shop_id": string }; Returns: undefined
                           },
"save_outfit":
{ Args: { "p_budget_millimes": number,"p_is_public": boolean,"p_items": Json,"p_name": string,"p_outfit_id": string }; Returns: string
                           },
"send_message":
{ Args: { "p_body": string,"p_conversation_id": string }; Returns: string
                           },
"set_product_availability":
{ Args: { "p_product_id": string,"p_status": Database["public"]['Enums']["product_status"] }; Returns: undefined
                           },
"set_products_publication":
{ Args: { "p_product_ids": (string)[],"p_status": Database["public"]['Enums']["publication_status"] }; Returns: {
              "problem": string,"product_id": string
            }[]
                           },
"set_user_status":
{ Args: { "p_reason": string,"p_status": Database["public"]['Enums']["account_status"],"p_user_id": string }; Returns: undefined
                           },
"set_video_products":
{ Args: { "p_product_ids": (string)[],"p_video_id": string }; Returns: undefined
                           },
"set_video_status":
{ Args: { "p_status": Database["public"]['Enums']["video_status"],"p_video_id": string }; Returns: undefined
                           },
"shop_stats":
{ Args: { "p_shop_id": string }; Returns: {
              "active_orders": number,"available": number,"delivered_revenue_millimes": number,"drafts": number,"open_requests": number,"pending_orders": number,"published": number,"reserved": number,"sold": number
            }[]
                           },
"start_conversation":
{ Args: { "p_body": string,"p_product_id": string,"p_request_id": string,"p_shop_id": string }; Returns: string
                           },
"top_shops":
{ Args: { "p_limit": number }; Returns: {
              "city_ar": string,"city_fr": string,"id": string,"name": string,"product_count": number,"slug": string
            }[]
                           },
"update_order_status":
{ Args: { "p_order_id": string,"p_status": Database["public"]['Enums']["order_status"] }; Returns: undefined
                           }
          }
          Enums: {
            "account_status": "active"|"suspended"|"deleted","app_locale": "fr"|"ar","block_side": "client"|"shop","fulfillment_method": "delivery"|"pickup","message_side": "client"|"shop","order_status": "pending"|"confirmed"|"preparing"|"shipped"|"delivered"|"cancelled","outfit_slot": "top"|"bottom"|"shoes"|"accessory","product_condition": "new_with_tags"|"like_new"|"very_good"|"good"|"fair","product_status": "available"|"reserved"|"sold","publication_status": "draft"|"published"|"archived","report_decision": "dismiss"|"remove_content"|"suspend","report_status": "open"|"resolved"|"dismissed","report_target": "product"|"video"|"conversation"|"shop"|"account"|"review","reservation_status": "active"|"converted"|"expired"|"cancelled","review_status": "published"|"hidden","shop_plan": "standard"|"pro","shop_role": "owner"|"manager"|"staff","shop_status": "pending"|"approved"|"rejected"|"suspended"|"closed","stock_request_status": "open"|"answered"|"closed","video_status": "draft"|"published"|"archived"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "account_status": ["active", "suspended", "deleted"],"app_locale": ["fr", "ar"],"block_side": ["client", "shop"],"fulfillment_method": ["delivery", "pickup"],"message_side": ["client", "shop"],"order_status": ["pending", "confirmed", "preparing", "shipped", "delivered", "cancelled"],"outfit_slot": ["top", "bottom", "shoes", "accessory"],"product_condition": ["new_with_tags", "like_new", "very_good", "good", "fair"],"product_status": ["available", "reserved", "sold"],"publication_status": ["draft", "published", "archived"],"report_decision": ["dismiss", "remove_content", "suspend"],"report_status": ["open", "resolved", "dismissed"],"report_target": ["product", "video", "conversation", "shop", "account", "review"],"reservation_status": ["active", "converted", "expired", "cancelled"],"review_status": ["published", "hidden"],"shop_plan": ["standard", "pro"],"shop_role": ["owner", "manager", "staff"],"shop_status": ["pending", "approved", "rejected", "suspended", "closed"],"stock_request_status": ["open", "answered", "closed"],"video_status": ["draft", "published", "archived"]
          }
        }
} as const
