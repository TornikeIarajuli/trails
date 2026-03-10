-- First clear existing test products
DELETE FROM public.products;

-- Seed shop with real products from CampShare.ge
INSERT INTO public.products (name, description, image_url, price, shop_name, external_url, is_published, sort_order) VALUES
(
  'Kayland STELLAR GTX',
  'Premium Gore-Tex hiking boot with Vibram outsole for maximum grip on technical terrain. Built for serious Georgian mountain trails.',
  'https://imagedelivery.net/5fsp7txo6EIjmJZsLEpfww/43134a71-c7a0-4777-7423-496cddb8e600/w=600,h=600',
  720.00,
  'CampShare',
  'https://campshare.ge/shop/product/348/kayland-stellar-gtx',
  true, 1
),
(
  'Kayland MIURA GTX',
  'Low-cut hiking shoe with Gore-Tex Extended Comfort waterproofing, suede upper, dual-density EVA midsole, and Vibram Multiverse outsole for mixed terrain.',
  'https://imagedelivery.net/5fsp7txo6EIjmJZsLEpfww/9b53c01a-570d-426b-3006-0e569bbb7500/w=600,h=600',
  408.75,
  'CampShare',
  'https://campshare.ge/shop/product/346/kayland-miura-gtx',
  true, 2
),
(
  'Kayland VISION W''s GTX',
  'Women''s high-cut hiking boot with Gore-Tex Extended Comfort waterproofing, suede midfoot, and Vibram Multiverse outsole for mixed terrain grip and stability.',
  'https://imagedelivery.net/5fsp7txo6EIjmJZsLEpfww/dfa16dc6-152e-4453-2f2b-c2a8635f7200/w=600,h=600',
  480.00,
  'CampShare',
  'https://campshare.ge/shop/product/345/kayland-vision-w-s-gtx',
  true, 3
),
(
  'Trezeta ARGO WP',
  'Waterproof high-top hiking boot with Water Stopper membrane, dual-density EVA midsole, and Vibram Multiland outsole for multi-terrain grip.',
  'https://imagedelivery.net/5fsp7txo6EIjmJZsLEpfww/2d6dcc7d-2966-493b-7021-d2d8b3c41500/w=600,h=600',
  294.00,
  'CampShare',
  'https://campshare.ge/shop/product/351/trezeta-argo-wp',
  true, 4
),
(
  'Gregory Wander 50',
  '50L hiking backpack with adjustable torso length, Wishbone alloy frame, hip belt pockets, hydration sleeve, and breathable padded suspension.',
  'https://imagedelivery.net/5fsp7txo6EIjmJZsLEpfww/9031feb7-f73c-4ef4-35b9-83f2a843a300/w=600,h=600',
  500.00,
  'CampShare',
  'https://campshare.ge/shop/product/747/gregory-wander-50',
  true, 5
),
(
  'ALPS Mountaineering Lynx 4',
  '4-person three-season tent with dual entrances, aluminum poles, and polyester fabric. 1,500mm waterproofing on fly, 2,000mm on floor.',
  'https://imagedelivery.net/5fsp7txo6EIjmJZsLEpfww/2a78644f-16c8-428d-01ee-d6d952948a00/w=600,h=600',
  576.00,
  'CampShare',
  'https://campshare.ge/shop/product/388/alps-mountaineering-lynx-4',
  true, 6
),
(
  'ALPS Mountaineering Lynx 2',
  'Lightweight 2-person backpacking tent with dual entrances, aluminum poles. Weighs 2.6 kg with 3.44 m² floor area. Three-season rated.',
  'https://imagedelivery.net/5fsp7txo6EIjmJZsLEpfww/a5ec7559-0293-4135-1972-74f9b08a8300/w=600,h=600',
  432.00,
  'CampShare',
  'https://campshare.ge/shop/product/241/alps-mountaineering-lynx-2',
  true, 7
),
(
  'ALPS Mountaineering Vibe 40 (+4°C)',
  'Mummy-style 2-season sleeping bag rated to +4°C. TechLoft Micro synthetic insulation with ripstop polyester shell and insulated chest baffle.',
  'https://imagedelivery.net/5fsp7txo6EIjmJZsLEpfww/b75739ff-cc14-4384-c337-3af14d0d2800/w=600,h=600',
  216.00,
  'CampShare',
  'https://campshare.ge/shop/product/576/alps-mountaineering-vibe-40-4-deg-c',
  true, 8
),
(
  'ALPS Mountaineering Genesis 30 (-1°C)',
  'Three-season sleeping bag with recycled TechLoft Micro insulation, recycled polyester ripstop shell, dual zippers for ventilation. Rated to -1°C.',
  'https://imagedelivery.net/5fsp7txo6EIjmJZsLEpfww/0c9b4d6e-3b4e-4b7b-3edd-70a256514b00/w=600,h=600',
  272.00,
  'CampShare',
  'https://campshare.ge/shop/product/579/alps-mountaineering-genesis-30-1-deg-c',
  true, 9
);
