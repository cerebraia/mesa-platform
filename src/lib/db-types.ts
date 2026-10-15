export type RestaurantStatus = "onboarding" | "active" | "suspended";
export type MemberRole = "owner" | "attention" | "kitchen";
export type MemberStatus = "invited" | "active" | "suspended";

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  status: RestaurantStatus;
  created_at: string;
  updated_at: string;
}

export interface RestaurantMember {
  id: string;
  restaurant_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  created_at: string;
}

export interface MembershipWithRestaurant {
  id: string;
  role: MemberRole;
  status: MemberStatus;
  restaurant_id: string;
  restaurants: Pick<
    Restaurant,
    "id" | "name" | "slug" | "status"
  > | null;
}
