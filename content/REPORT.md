# Trail catalogue re-check — report

Generated 2026-11-13 14:54 UTC from the production snapshot `content/snapshot/production-2026-11-13.json` (105 published trails, 239 checkpoints, 322 media rows, fetched 2026-11-12 22:09 UTC from the public API).

Nothing has been written to production. `scripts/content/apply.mjs` publishes `content/trails.json` and `content/images/` (dry run by default).

## Totals

- Existing trails re-checked: **105**; with at least one corrected value: **95**.
- Values changed (existing trails): estimated_hours 78, elevation_gain_m 71, route 62, start_point 62, end_point 62, distance_km 52, description_en 45, description_ka 45, difficulty 14, name_ka 11, region 10, name_en 6.
- Routes rebuilt from OpenStreetMap: **58**; routes kept: 47 (of which 4 only reversed to run in the direction of the trail name); routes left for manual review: **13** (12 of them not measurable, so their distance/ascent/time/difficulty are unchanged and unverified).
- New trails: **85** accepted from 174 OSM hiking/foot relations not yet in the catalogue; 89 rejected (reasons below).
- Checkpoints: 239 existing (150 moved, 92 confirmed against named OSM features, shelters/springs/camps **not** confirmable in OSM (now not checkable): 1, 35 with an unverifiable position left in place), 312 new; elevation filled for 551 from SRTM.
- Photos: 568 real Wikimedia Commons photos for 175 of 190 trails. Cover match: on-trail 144, nearby 17, area 14, no photo 15. All photos: on-trail 428, nearby 67, area 73. Licences: CC BY 155, CC BY-SA 404, CC0 9. `content/images`: 569 WebP files, 99.8 MB.
- OpenTopoData requests used: 315 on 2026-11-13 (limit 1000/day). No route was left unmeasured for lack of budget.

## How the values were obtained (measured vs estimated)

- **Distance** — length (haversine) of the route as stored or rebuilt, at full OSM resolution; replaced when the stored value differed by more than 10 %. It is the length of the line as drawn: most destination hikes ("X to Y Glacier", lakes) are one way, so the old hand-entered figures that were round trips now read about half. Trails whose line is an out-and-back are flagged.
- **Ascent / descent** — SRTM 30 m (ASTER 30 m for voids) via OpenTopoData, sampled every ≤ ~120 m along the line (at most 400 samples, so long treks are sampled more coarsely), 1-2-1 smoothed, counted with a 10 m hysteresis. Replaced where the stored value was the synthetic distance × 60 / × 40 or more than 25 % off. **These are estimates**: a 30 m DEM on a line simplified to ≤ 600 points misses short ups and downs and smooths narrow ridges; real ascent is usually somewhat higher.
- **Time** — DIN 33466 (4 km/h horizontal, 300 m/h up, 500 m/h down; the larger of horizontal and vertical time plus half the smaller), rounded to 0.5 h; walking time only, no breaks. Updated where distance or ascent changed and for all OSM-imported (synthesised) trails.
- **Difficulty** — effort = km + ascent/100: easy < 12, medium 12–25, hard 25–45, ultra > 45, one level up when the highest point is above 3000 m. Applied to the synthesised trails (ids …100–…148); hand-curated trails kept theirs unless the formula differs by two or more levels (listed below).
- **Region** — OSM municipality boundaries mapped to the app vocabulary (Svaneti, Tusheti, Kakheti, Kazbegi, Khevsureti, Borjomi-Kharagauli, Tbilisi, Imereti, Samegrelo, Adjara, Racha, Samtskhe-Javakheti, Kvemo Kartli, Shida Kartli, Mtskheta-Mtianeti, Guria). Changed only when the start and the middle of the route (or 80 % of it) agree on another region. Trails starting within 15 km of the Tbilisi city boundary keep or get "Tbilisi", matching how the catalogue already used it.
- **Checkpoints** — a checkpoint whose name is a real place was looked up among named OSM features within 1.5 km of the route and moved to the route point nearest that feature. Shelters, water sources and campsites need a mapped hut / spring / camp site within 150 m of the route; otherwise they were made not checkable and are listed below. Elevations are SRTM values at the checkpoint.

## Every existing trail

Values are old → **new**; unchanged values are shown once. Route: rebuilt / kept / reversed; **review** = needs a human (see the next sections).

| id | Trail | km | ascent m | hours | difficulty | region | route | notes |
|---|---|---|---|---|---|---|---|---|
| 001 | Gergeti Trinity Church | 6 | 500 | 2.5 | easy | Kazbegi | rebuilt | max 2183 m |
| 002 | Mestia to Ushguli Trek | 58 → **47** | 3200 | 28 → **21** | hard | Svaneti | rebuilt | max 2983 m |
| 003 | Juta to Roshka (Abudelauri Lakes) | 26 → **19.8** | 1800 → **1223** | 10 → **9.5** | hard | Kazbegi | rebuilt | max 3337 m |
| 004 | Omalo to Dartlo | 14 → **15.6** | 650 | 5 → **5.5** | medium | Tusheti | rebuilt | max 2290 m |
| 005 | Truso Valley | 24 → **10.1** | 400 → **240** | 6 → **3** | easy | Kazbegi | rebuilt | max 2241 m |
| 006 | Ninoskhevi Waterfall | 14 → **11.6** | 300 → **648** | 4 → **5** | easy | Kakheti | kept | max 1078 m |
| 007 | Borjomi-Kharagauli: Likani Trail | 18 → **33.5** | 1100 → **1427** | 7 → **12.5** | medium → **ultra** | Borjomi-Kharagauli | rebuilt, reversed | max 2142 m |
| 008 | Chaukhi Pass | 16 → **9.3** | 1500 | 9 → **6** | ultra | Kazbegi | rebuilt | max 3337 m |
| 009 | Martvili Canyon Trail | 3 | 50 | 1 | easy | Samegrelo | kept, **review** | not measurable — values unverified |
| 010 | Okatse Canyon Trail | 7 | 200 | 2.5 | easy | Imereti | kept, **review** | not measurable — values unverified |
| 011 | Shatili to Mutso | 12 | 800 → **201** | 5 → **3.5** | hard | Khevsureti | rebuilt | max 1561 m |
| 012 | Tobavarchkhili (Silver Lake) | 44 → **66.6** | 2800 → **3979** | 24 → **29** | ultra | Samegrelo | rebuilt | max 2893 m |
| 013 | Koruldi Lakes | 12 → **8.8** | 1200 | 5 | medium | Svaneti | rebuilt, reversed | max 2741 m |
| 014 | Mestia to Chalaadi Glacier | 8 | 300 → **512** | 3 | easy | Svaneti | rebuilt | max 1974 m |
| 015 | Mazeri to Ushba Glacier | 14 → **5.2** | 800 | 6 → **3.5** | medium | Svaneti | rebuilt | max 2435 m |
| 016 | Mestia - Guli Pass - Mazeri | 20 | 1500 | 9 | hard | Svaneti | rebuilt, reversed | max 2939 m |
| 017 | Ushguli to Chvelpi | 6 → **22.4** | 200 → **1010** | 2 → **10** | easy → **hard** | Svaneti | rebuilt | max 2965 m |
| 018 | Ushguli to Shkhara Glacier | 16 → **8.6** | 700 → **459** | 6 → **3** | medium | Svaneti | kept | max 2570 m |
| 019 | Laila Glacier Trail | 18 → **10.9** | 1300 → **1977** | 8 → **8.5** | hard | Svaneti | rebuilt | max 3102 m |
| 020 | Zhabeshi to Tviberi Glacier | 12 → **8.4** | 600 → **775** | 5 → **4** | medium | Svaneti | rebuilt, reversed | max 2319 m |
| 021 | Mazeri - Meziri Lake - Etseri | 15 | 1100 | 7 | hard | Svaneti | rebuilt | max 2460 m |
| 022 | Mestia - Hatsvali - Zuruldi | 10 → **6** | 900 | 4 | medium | Svaneti | kept | max 2343 m |
| 023 | Mount Laila Traverse | 30 | 2200 | 16 | ultra | Svaneti | rebuilt | max 3391 m |
| 024 | Khaishi to Lakumura Lake | 22 | 1400 → **2067** | 10 | hard | Svaneti | rebuilt | max 2575 m |
| 025 | Okrostskali Lakes | 14 → **35.6** | 900 → **2426** | 6 → **13.5** | medium → **ultra** | Svaneti | rebuilt | max 2935 m |
| 026 | Lake Memuli | 10 → **6.8** | 800 → **1482** | 5 → **6** | medium | Svaneti | kept | max 2762 m |
| 027 | Latali to Mheer Church | 8 | 400 → **1246** | 3 → **5.5** | easy | Svaneti | kept | max 2459 m |
| 028 | Chvabiani to Adishi | 14 → **9.7** | 700 → **923** | 5 | medium | Svaneti | kept | max 2479 m |
| 029 | Kala to Latpari Pass | 16 → **9.7** | 1200 | 7 → **5** | hard | Svaneti | kept | max 2837 m |
| 030 | Mestia Cross Trail | 5 | 350 → **761** | 2 → **4.5** | easy | Svaneti | kept | max 2171 m |
| 031 | Etseri to Bak Pass | 12 → **6.5** | 1000 | 6 → **4** | hard | Svaneti | kept, reversed | max 2414 m |
| 032 | Leiraki Waterfall Trail | 10 → **5.3** | 500 → **0** | 4 → **2** | medium | Svaneti | kept | max 2095 m |
| 033 | Shuano Mountain Trail | 14 → **28.3** | 1100 → **1473** | 7 → **11.5** | hard | Svaneti → **Borjomi-Kharagauli** | rebuilt | max 2227 m |
| 034 | Gvirgvina Mountain Trail | 16 → **25.7** | 1300 → **663** | 8 → **9.5** | hard | Svaneti → **Borjomi-Kharagauli** | rebuilt, reversed | max 2266 m |
| 035 | Atsunta Pass | 55 → **78.4** | 3000 | 28 → **27.5** | ultra | Tusheti | rebuilt | max 3509 m |
| 036 | Omalo to Diklo | 18 → **9.6** | 800 | 7 → **5** | medium | Tusheti | rebuilt | max 2186 m |
| 037 | Omalo Round Trail | 35 | 2000 | 16 | hard | Tusheti | kept, **review** | not measurable — values unverified |
| 038 | Diklo to Dartlo Red Trail | 25 → **15.7** | 1500 → **813** | 10 → **7** | hard | Tusheti | rebuilt, reversed | max 2448 m |
| 039 | Omalo to Nakle Kholi Pass | 20 → **7** | 1400 | 9 → **5.5** | hard | Tusheti | rebuilt | max 2925 m |
| 040 | Oreti Lake Hike | 14 → **10.7** | 1000 | 6 → **5** | hard | Tusheti | rebuilt | max 2666 m |
| 041 | Juta Waterfall and Lake | 10 | 400 | 3.5 | easy | Kazbegi | kept, **review** | not measurable — values unverified |
| 042 | Arsha to Stepantsminda | 8 | 250 | 2.5 | easy | Kazbegi | kept, **review** | not measurable — values unverified |
| 043 | Lagodekhi Black Rock Lake | 24 → **41.5** | 1600 → **2517** | 12 → **18.5** | hard | Kakheti | rebuilt | max 2857 m |
| 044 | Yew Tree and Tbikeli Lake | 16 → **10.9** | 800 → **1525** | 7 | medium | Kakheti → **Adjara** | rebuilt | renamed from "Lagodekhi Yew Tree and Tbikeli Lake"; max 2417 m |
| 045 | Borjomi Panorama Trail | 34 → **27.3** | 2000 | 14 → **12.5** | hard | Borjomi-Kharagauli | rebuilt | max 2188 m |
| 046 | St. Andrews Trail | 20 → **56.9** | 1000 → **2903** | 8 → **21.5** | medium → **ultra** | Borjomi-Kharagauli | rebuilt | max 2558 m |
| 047 | Shepherds Trail | 16 | 900 | 7 | medium | Borjomi-Kharagauli | rebuilt | max 2428 m |
| 048 | Pure Pristine Forest Trail | 10 → **12.9** | 400 → **807** | 4 → **6** | easy | Borjomi-Kharagauli | kept | max 1701 m |
| 049 | Following Wildlife Traces | 8 → **14.8** | 300 → **882** | 3 → **6.5** | easy | Borjomi-Kharagauli | rebuilt | max 1783 m |
| 050 | Sairme Pass Trail | 14 | 800 | 6 | medium | Borjomi-Kharagauli | kept, **review** | not measurable — values unverified |
| 051 | Mtatsminda to Narikala Fortress | 5 → **3.7** | 200 → **12** | 2 → **1.5** | easy | Tbilisi | rebuilt, reversed | max 721 m |
| 052 | Tbilisi National Park Trail | 12 → **14.4** | 600 → **837** | 5 → **6** | medium | Tbilisi | rebuilt | max 1426 m |
| 053 | Mtatsminda to Kojori | 16 → **10** | 700 | 6 → **4** | medium | Tbilisi | kept | max 1406 m |
| 054 | Betania to Kveseti | 8 → **13.6** | 300 → **663** | 3 → **5** | easy | Tbilisi | kept | max 1422 m |
| 055 | Kiketi to Kabeni Monastery | 6 → **3.8** | 250 → **45** | 2.5 → **1.5** | easy | Tbilisi | kept, reversed | max 1168 m |
| 056 | Kojori to Kabeni Waterfalls | 10 → **11.2** | 500 | 4 | medium | Tbilisi | rebuilt | max 1282 m |
| 100 | Adishi - Iprali | 23.3 → **16.9** | 1398 → **622** | 9.3 → **6** | hard → **medium** | Svaneti | rebuilt | max 2718 m |
| 101 | Adventure track | 3.4 | 204 → **258** | 0.9 → **2** | easy | Borjomi-Kharagauli | kept | max 1093 m |
| 102 | Bak Pass - Dolasvipi | 7.4 | 444 → **46** | 1.9 → **3.5** | easy | Svaneti | kept | max 2456 m |
| 103 | Bak Pass - Mazeri | 5 | 300 → **43** | 1.3 → **2.5** | easy | Svaneti | kept, reversed | max 2416 m |
| 104 | Black | 8.1 | 486 → **541** | 2 → **4** | easy → **medium** | Borjomi-Kharagauli | kept | max 1451 m |
| 105 | Children Learning Track | 0.9 | 36 → **17** | 0.2 → **0.5** | easy | Kakheti | kept | max 597 m |
| 106 | Dartlo - Kvavlo | 1.9 | 114 → **363** | 0.5 → **1.5** | easy | Tusheti | kept | renamed from "Dartlo–Kvavlo"; max 2160 m |
| 107 | Dolasvipi - Latali | 9.8 → **5.4** | 588 → **380** | 2.5 | easy | Svaneti | rebuilt, reversed | max 1653 m |
| 108 | Ebudi - Dolasvipi | 5.5 | 330 → **0** | 1.4 → **2** | easy | Svaneti | kept | max 1683 m |
| 109 | Gulebi Fortress route | 13.6 → **6.6** | 816 → **914** | 4.5 → **4** | medium | Adjara | rebuilt | max 1123 m |
| 110 | Guli glacier and Ushba base path | 2.9 | 174 → **581** | 0.7 → **2.5** | easy | Svaneti | kept | max 2936 m |
| 111 | Iprari - Ushguli | 12.1 | 726 → **453** | 4 | medium | Svaneti | kept | max 2159 m |
| 112 | Jokolo - Duisi | 3.4 | 109 → **77** | 0.9 → **1** | easy | Kakheti | rebuilt, reversed | renamed from "Jokolo => Duisi"; max 737 m |
| 113 | Kachou Fortress | 0.8 → **1.1** | 32 → **165** | 0.2 → **1** | easy | Tusheti → **Khevsureti** | rebuilt | max 1588 m |
| 114 | Khikhadziri village - Shuamta lakes - Khikhani fortress | 24.7 | 1482 → **1337** | 9.9 → **10** | hard | Adjara | rebuilt | max 2209 m |
| 115 | Lentekhi - Matskhvarishi | 32.1 | 1926 → **3504** | 12.8 → **19.5** | hard → **ultra** | Svaneti | rebuilt, reversed | max 3551 m |
| 116 | Mami - Latpri pass | 10 | 600 → **1688** | 3.3 → **7** | medium → **hard** | Svaneti | kept, reversed, **review** | max 2845 m |
| 117 | Mazeri - Hiker-Inn | 2.6 | 104 → **28** | 0.7 → **0.5** | easy | Svaneti | rebuilt, reversed | max 1666 m |
| 118 | Mestia - Adishi | 23.8 → **12** | 1428 → **524** | 9.5 → **4.5** | hard → **medium** | Svaneti | kept | max 1910 m |
| 119 | Mestia - Heshkili - Ieli - Tsvirmi - Tetnuldi Ski Lift | 25.3 | 1518 → **1393** | 10.1 → **9** | hard | Svaneti | rebuilt | max 2324 m |
| 120 | Mestia - Koruldi Lakes - Becho | 22.9 | 1374 → **1839** | 9.2 → **12.5** | hard | Svaneti | rebuilt | max 2934 m |
| 121 | Mestia - Zabeshi | 26.2 → **14.2** | 1572 → **567** | 10.5 → **5** | hard → **medium** | Svaneti | rebuilt, reversed | max 1910 m |
| 122 | Mindazeebi village - Kikibo pastures (yaylas) | 42.2 | 2532 → **1965** | 21.1 → **15.5** | ultra | Adjara | rebuilt | max 2631 m |
| 123 | Mutso castle | 1.1 → **0.7** | 66 → **0** | 0.3 → **0.5** | easy | Tusheti → **Khevsureti** | rebuilt | max 1710 m |
| 124 | N1 Tsvirmi - Ieli | 8.9 → **7.5** | 534 → **599** | 2.2 → **3** | easy → **medium** | Svaneti | rebuilt, reversed | max 2356 m |
| 125 | Nasabajvari trail | 19 | 1140 → **432** | 6.3 → **6.5** | medium | Imereti → **Borjomi-Kharagauli** | kept | max 2379 m |
| 126 | National Park Information Trail | 2.3 | 92 → **178** | 0.6 → **1** | easy | Borjomi-Kharagauli | rebuilt | renamed from "National Park Information Tail"; max 978 m |
| 127 | Omalo-Shatili | 196.5 | 11790 | 98.3 | ultra | Tusheti | kept, **review** | not measurable — values unverified |
| 128 | Oniore Waterfalls tourist trails | 12.4 | 744 → **543** | 4.1 → **4.5** | medium | Imereti → **Samegrelo** | rebuilt | max 720 m |
| 129 | Path to King David's tower | 1.1 → **0.6** | 44 → **41** | 0.3 → **0.5** | easy | Imereti | rebuilt, reversed | max 391 m |
| 130 | Roshka - Juta | 11 → **19.8** | 660 → **1393** | 3.7 → **9.5** | medium → **ultra** | Khevsureti | rebuilt | max 3337 m |
| 131 | Sairme pillars trail | 2.5 | 150 → **294** | 0.6 → **1.5** | easy | Imereti → **Racha** | kept | max 817 m |
| 132 | Samshvilde canyon trail | 17.8 | 1068 | 5.9 | medium | Tbilisi → **Kvemo Kartli** | kept, **review** | not measurable — values unverified |
| 133 | Snow Shoes Trail | 21.6 | 1296 | 8.6 | hard | Borjomi-Kharagauli | kept, **review** | not measurable — values unverified |
| 134 | Sulda Wetland | 4.6 | 184 → **0** | 1.2 → **1** | easy | Samtskhe-Javakheti | kept | max 1898 m |
| 135 | Tbilisi Hiking trail | 8.7 → **5.1** | 522 → **111** | 2.2 → **1.5** | easy | Tbilisi | rebuilt | renamed from "Tbilsi Hiking trail"; max 848 m |
| 136 | Tetnuldi Ski Resort - Adishi | 6.2 | 372 → **165** | 1.6 → **2** | easy | Svaneti | kept | max 2479 m |
| 137 | Tivasula fortress path | 3.8 → **2.7** | 228 → **153** | 1 | easy | Adjara | rebuilt | max 341 m |
| 138 | Toba-Oniore | 1.2 | 48 → **0** | 0.3 → **0.5** | easy | Imereti → **Samegrelo** | kept | max 358 m |
| 139 | Trail 1: 19th c | 16.9 | 1014 | 5.6 | medium | Borjomi-Kharagauli | kept, **review** | not measurable — values unverified; renamed from "Trail 1: 19th c." |
| 140 | Transcaucasian Trail | 156.4 | 9384 → **3959** | 78.2 → **51** | ultra | Samtskhe-Javakheti | rebuilt | max 3087 m |
| 141 | Transcaucasian Trail: Upper Svaneti 2 (Alternate) | 6.5 | 390 → **664** | 1.6 → **3.5** | easy → **medium** | Svaneti | kept | max 1885 m |
| 142 | Transcaucasian Trail: Upper Svaneti 4 (Alternate) | 3.4 | 204 → **96** | 0.9 → **1** | easy | Svaneti | kept | max 1642 m |
| 143 | Tsaleri - Kichkhuldashi | 11.1 | 894 | 3.7 → **6** | medium | Svaneti | kept | max 2354 m |
| 144 | Tsaleri - mount Kva - Place Zagari | 12.6 | 1130 | 4.2 → **7** | medium | Svaneti | kept | max 2750 m |
| 145 | Tsvirmi - Zuruldi Ski Lift - Heshkili - Lemsia | 17.6 | 1056 → **746** | 5.9 → **7** | medium → **hard** | Svaneti | rebuilt | max 2455 m |
| 146 | Tusheti Omalo 2-3 Nights Round Trail | 61.4 | 3684 | 30.7 | ultra | Tusheti | kept, **review** | not measurable — values unverified |
| 147 | Two Mountains Trail | 55.5 | 3330 | 27.8 | ultra | Adjara | kept, **review** | not measurable — values unverified |
| 148 | Ushkhvanari - Latali | 6.7 | 402 → **304** | 1.7 → **2.5** | easy | Svaneti | kept | max 1714 m |

## Routes rebuilt from OpenStreetMap (58)

Each was rebuilt by stitching the relation's member ways into one continuous line in travel order (gaps ≤ 150 m), then simplified with Douglas–Peucker to ≤ 600 points. Where a trail had no relation of its own, or its relation was deleted from OSM, the line is the walk between two named places along a relation that covers it — decided by hand and recorded in `scripts/content/data/geometry-overrides.json`.

- **001 Gergeti Trinity Church** — stored route broken (only 3 points covering 0.3 km of a 6 km trail) — rebuilt from OSM relation 21149649 (member-order); 3 → 219 points, 0.34 → 5.36 km, longest segment 177 → 115 m. OSM ways joined across a gap of 93 m; identified by hand: OSM relation 21149649 'Stepantsminda–Gergeti Church' is this hike (it passes 11 m from the church); the stored line has 3 points.
- **002 Mestia to Ushguli Trek** — stored route broken (only 7 points covering 0.7 km of a 58 km trail) — rebuilt from OSM relation 13703284 + 13703285 (joined-relations); 7 → 593 points, 0.7 → 47.04 km, longest segment 205 → 522 m. identified by hand: the two Transcaucasian Trail stage relations Mestia–Adishi and Adishi–Ushguli, as mapped in the original import script; the stored line has 7 points.
- **003 Juta to Roshka (Abudelauri Lakes)** — stored route coarse (300-point decimation) — rebuilt from OSM relation 17899876 [Juta (node/448929968, 11 m from the ways) → Roshka (node/449219302, 214 m from the ways) on relation 17899876] (path-between-anchors); 300 → 576 points, 11.44 → 19.81 km, longest segment 221 → 201 m. identified by hand: relation 3817920 'Roshka - Juta' was deleted from OSM; 17899876 'Chaukhi Pass Trail' replaces it and offers one line between the two villages (only a 34 m variant).
- **004 Omalo to Dartlo** — stored route broken (only 2 points covering 0.3 km of a 14 km trail) — rebuilt from OSM relation 21145876 [Omalo (node/826106795, 10 m from the ways) → Dartlo (node/449209837, 134 m from the ways) on relation 21145876] (path-between-anchors); 2 → 526 points, 0.28 → 15.6 km, longest segment 281 → 157 m. OSM ways joined across a gap of 106 m; identified by hand: no relation of its own; Omalo to Dartlo is the first stage of relation 21145876 'Omalo–Shatili', which has a single line between the two villages; the stored line has 2 points.
- **005 Truso Valley** — stored route broken (only 2 points covering 0.3 km of a 24 km trail) — rebuilt from OSM relation 21149704 [42.5814,44.4647 → 42.6115,44.374 on relation 21149704] (path-between-anchors); 2 → 448 points, 0.25 → 10.07 km, longest segment 255 → 119 m. OSM ways joined across a gap of 21 m; identified by hand: relation 21149704 'Truso Valley' from its trailhead at Kvemo Okrokana to Zakagori Fortress (the trail's last checkpoint); the relation's other members are short spurs to springs and viewpoints; the stored line has 2 points.
- **007 Borjomi-Kharagauli: Likani Trail** — stored route broken (jump of 11.2 km between consecutive points) — rebuilt from OSM relation 3740297 (graph); 300 → 583 points, 42.78 → 33.49 km, longest segment 11191 → 309 m. identified by hand: the trail starts at the Likani park entrance (its first checkpoint); OSM draws the relation from the Marelisi end.
- **008 Chaukhi Pass** — stored route coarse (300-point decimation) — rebuilt from OSM relation 17899876 [Juta (node/448929968, 11 m from the ways) → 42.5555,44.8171 on relation 17899876] (path-between-anchors); 300 → 521 points, 4.19 → 9.26 km, longest segment 80 → 104 m. identified by hand: the Juta side of relation 17899876 'Chaukhi Pass Trail' up to the Chaukhi Pass node; the stored line was a 4 km piece of the deleted relation 3817920.
- **011 Shatili to Mutso** — stored route broken (only 15 points covering 0.3 km of a 12 km trail) — rebuilt from OSM relation 12211099 [Shatili (node/430738640, 129 m from the ways) → Mutso (node/430738641, 15 m from the ways) on relation 12211099] (path-between-anchors); 15 → 445 points, 0.31 → 11.14 km, longest segment 33 → 100 m. OSM ways joined across a gap of 81 m; identified by hand: no relation of its own; relation 12211099 'Omalo-Shatili' has a single line between Shatili and Mutso; the stored line has 15 points covering 0.3 km.
- **012 Tobavarchkhili (Silver Lake)** — stored route broken (only 2 points covering 0.2 km of a 44 km trail) — rebuilt from OSM relation 15354522 [Mukhuri (node/403807596, 113 m from the ways) → Skuri (node/403808904, 79 m from the ways) on relation 15354522] (path-between-anchors); 2 → 599 points, 0.2 → 66.58 km, longest segment 200 → 659 m. review: the relation offers a variant for 1.0 km of this line; the shorter way was taken; identified by hand: relation 15354522 'Mukhuri - Tobavarchkhili Lakes - Skuri' between its two villages; the stored line has 2 points.
- **013 Koruldi Lakes** — stored route broken (jump of 4.2 km between consecutive points) — rebuilt from OSM relation 3684676 (graph); 300 → 571 points, 15.16 → 8.77 km, longest segment 4244 → 120 m.
- **014 Mestia to Chalaadi Glacier** — stored route broken (jump of 5.8 km between consecutive points) — rebuilt from OSM relation 3671427 (graph); 300 → 435 points, 14.13 → 8.22 km, longest segment 5810 → 102 m.
- **015 Mazeri to Ushba Glacier** — stored route coarse (300-point decimation) — rebuilt from OSM relation 2418279 (graph); 300 → 547 points, 5.02 → 5.15 km, longest segment 80 → 59 m.
- **016 Mestia - Guli Pass - Mazeri** — stored route broken (jump of 10.6 km between consecutive points) — rebuilt from OSM relation 2418280 (graph); 300 → 585 points, 29.79 → 20.67 km, longest segment 10626 → 285 m.
- **017 Ushguli to Chvelpi** — stored route coarse (300-point decimation) — rebuilt from OSM relation 2418278 (graph); 300 → 584 points, 21.27 → 22.43 km, longest segment 380 → 145 m.
- **019 Laila Glacier Trail** — stored route coarse (300-point decimation) — rebuilt from OSM relation 10507483 (graph); 258 → 333 points, 10.49 → 10.89 km, longest segment 254 → 167 m.
- **020 Zhabeshi to Tviberi Glacier** — stored route coarse (300-point decimation) — rebuilt from OSM relation 10507503 (graph); 300 → 548 points, 7.76 → 8.41 km, longest segment 1040 → 307 m.
- **021 Mazeri - Meziri Lake - Etseri** — stored route coarse (300-point decimation) — rebuilt from OSM relation 13078189 (graph); 300 → 573 points, 14.2 → 14.64 km, longest segment 230 → 141 m.
- **023 Mount Laila Traverse** — stored route coarse (300-point decimation) — rebuilt from OSM relation 15352304 (graph); 300 → 558 points, 26.3 → 27.53 km, longest segment 429 → 298 m.
- **024 Khaishi to Lakumura Lake** — stored route coarse (300-point decimation) — rebuilt from OSM relation 15352496 (member-order); 300 → 579 points, 18.87 → 20.04 km, longest segment 185 → 180 m. OSM ways joined across a gap of 4 m.
- **025 Okrostskali Lakes** — stored route coarse (300-point decimation) — rebuilt from OSM relation 15378089 (graph); 28 → 598 points, 3.6 → 35.63 km, longest segment 1449 → 380 m. identified by hand: relation 15378089 'Lukhi — Okrotskali Lakes Trail' as mapped in the original import; the stored line has 28 points covering a tenth of it.
- **033 Shuano Mountain Trail** — stored route coarse (300-point decimation) — rebuilt from OSM relation 15913814 (graph); 300 → 596 points, 30.07 → 28.32 km, longest segment 784 → 245 m.
- **034 Gvirgvina Mountain Trail** — stored route coarse (300-point decimation) — rebuilt from OSM relation 15913873 (graph); 298 → 599 points, 24.03 → 25.7 km, longest segment 1275 → 606 m.
- **035 Atsunta Pass** — stored route coarse (300-point decimation) — rebuilt from OSM relation 21145876 + 12211099 [42.52868,45.27413 → Shatili (node/430738640, 129 m from the ways) on relation 12211099] (joined-relations); 220 → 592 points, 9.73 → 78.43 km, longest segment 188 → 527 m. side spurs of the relation not included: 130 m; OSM ways joined across a gap of 106 m; identified by hand: relation 3817760 'Omalo - Atsunta' was deleted from OSM; 21145876 'Omalo–Shatili' now runs from Omalo to the Atsunta Pass node and relation 12211099 continues from that node down to Shatili.
- **036 Omalo to Diklo** — stored route coarse (300-point decimation) — rebuilt from OSM relation 12211128 [Omalo (node/826106795, 10 m from the ways) → Diklo (node/449209833, 214 m from the ways) on relation 12211128] (path-between-anchors); 300 → 473 points, 18.52 → 9.61 km, longest segment 351 → 104 m. identified by hand: relation 12211128 'Omalo–Diklo' has a detached piece 576 m away, but a single line between the two villages.
- **038 Diklo to Dartlo Red Trail** — stored route broken (jump of 2.5 km between consecutive points) — rebuilt from OSM relation 13316316 + 21147132 (joined-relations); 300 → 588 points, 15.93 → 15.65 km, longest segment 2480 → 244 m. identified by hand: the trail is now two relations in OSM that meet in Chigho: 13316316 (Diklo–Chigho) and 21147132 'Diklo–Chigho–Dartlo' (Chigho–Dartlo).
- **039 Omalo to Nakle Kholi Pass** — stored route coarse (300-point decimation) — rebuilt from OSM relation 10485517 (graph); 110 → 172 points, 5.23 → 6.98 km, longest segment 351 → 351 m.
- **040 Oreti Lake Hike** — stored route coarse (300-point decimation) — rebuilt from OSM relation 10506208 (member-order); 300 → 362 points, 13.44 → 10.7 km, longest segment 165 → 134 m. OSM ways joined across a gap of 118 m.
- **043 Lagodekhi Black Rock Lake** — stored route coarse (300-point decimation) — rebuilt from OSM relation 10543211 (graph-loop); 289 → 588 points, 34.53 → 41.49 km, longest segment 767 → 415 m. side spurs of the relation not included: 493 m.
- **044 Lagodekhi Yew Tree and Tbikeli Lake** — stored route coarse (300-point decimation) — rebuilt from OSM relation 10543228 (graph); 300 → 577 points, 10.37 → 10.94 km, longest segment 220 → 197 m.
- **045 Borjomi Panorama Trail** — stored route coarse (300-point decimation) — rebuilt from OSM relation 3740332 (member-order); 300 → 591 points, 25.12 → 27.32 km, longest segment 264 → 218 m. OSM ways joined across a gap of 55 m.
- **046 St. Andrews Trail** — stored route broken (jump of 2.3 km between consecutive points) — rebuilt from OSM relation 3740333 (graph-longest-path); 89 → 597 points, 10.86 → 56.87 km, longest segment 2301 → 468 m. side spurs of the relation not included: 1203 m; OSM ways joined across a gap of 55 m; identified by hand: relation 3740333 'St. Andrew’s Trail' as mapped in the original import; the stored line covers a fifth of it.
- **047 Shepherds Trail** — stored route broken (jump of 2.0 km between consecutive points) — rebuilt from OSM relation 3740346 [41.87169,43.25028 → 41.83366,43.12575 on relation 3740346] (path-between-anchors); 300 → 555 points, 19.04 → 15.42 km, longest segment 1999 → 134 m. identified by hand: relation 3740346 'Shepherd's trail' is a line with one side branch; the stored route starts and ends at two of its three ends, which leaves exactly one line.
- **049 Following Wildlife Traces** — stored route coarse (300-point decimation) — rebuilt from OSM relation 3740353 (graph); 300 → 505 points, 14.46 → 14.81 km, longest segment 196 → 179 m.
- **051 Mtatsminda to Narikala Fortress** — stored route broken (jump of 2.0 km between consecutive points) — rebuilt from OSM relation 15081599 (graph); 300 → 302 points, 5.67 → 3.66 km, longest segment 2014 → 431 m.
- **052 Tbilisi National Park Trail** — stored route broken (jump of 7.9 km between consecutive points) — rebuilt from OSM relation 14077975 (graph-longest-path); 300 → 387 points, 22.51 → 14.43 km, longest segment 7890 → 148 m. side spurs of the relation not included: 393 m.
- **056 Kojori to Kabeni Waterfalls** — stored route coarse (300-point decimation) — rebuilt from OSM relation 15656966 (member-order); 300 → 474 points, 10.64 → 11.21 km, longest segment 355 → 146 m. OSM ways joined across a gap of 76 m; identified by hand: relation 15656966 'Kojori — Kabeni Monastery — Kabeni Waterfalls Trail' as mapped in the original import (the relation has been extended since).
- **100 Adishi - Iprali** — stored route broken (jump of 5.9 km between consecutive points) — rebuilt from OSM relation 3685972 (member-order); 300 → 517 points, 23.29 → 16.89 km, longest segment 5902 → 160 m. OSM ways joined across a gap of 7 m.
- **107 Dolasvipi - Latali** — stored route coarse (300-point decimation) — rebuilt from OSM relation 14639546 (graph); 298 → 404 points, 6.12 → 5.41 km, longest segment 235 → 88 m.
- **109 Gulebi Fortress route** — stored route broken (jump of 1.8 km between consecutive points) — rebuilt from OSM relation 14078002 (graph); 300 → 262 points, 13.55 → 6.62 km, longest segment 1809 → 130 m. identified by hand: relation 14078002 'Gulebi Fortress route' (same name); the stored line walks it twice with a 1.8 km jump.
- **112 Jokolo => Duisi** — stored route coarse (300-point decimation) — rebuilt from OSM relation 14192152 (member-order); 179 → 143 points, 4.46 → 3.5 km, longest segment 334 → 101 m. OSM ways joined across a gap of 29 m.
- **113 Kachou Fortress** — stored route coarse (300-point decimation) — rebuilt from OSM relation 17899816 (graph); 43 → 55 points, 0.79 → 1.09 km, longest segment 64 → 64 m.
- **114 Khikhadziri village - Shuamta lakes - Khikhani fortress** — stored route broken (jump of 3.2 km between consecutive points) — rebuilt from OSM relation 14277181 (graph-lollipop); 300 → 597 points, 24.7 → 23.54 km, longest segment 3157 → 193 m.
- **115 Lentekhi - Matskhvarishi** — stored route coarse (300-point decimation) — rebuilt from OSM relation 15351593 (member-order); 300 → 593 points, 32.14 → 34.65 km, longest segment 464 → 343 m. OSM ways joined across a gap of 4 m.
- **117 Mazeri - Hiker-Inn** — stored route coarse (300-point decimation) — rebuilt from OSM relation 14696809 (member-order); 61 → 65 points, 2.58 → 2.58 km, longest segment 282 → 223 m. OSM ways joined across a gap of 55 m.
- **119 Mestia - Heshkili - Ieli - Tsvirmi - Tetnuldi Ski Lift** — stored route coarse (300-point decimation) — rebuilt from OSM relation 3684715 (graph); 300 → 584 points, 25.35 → 26.21 km, longest segment 316 → 258 m.
- **120 Mestia - Koruldi Lakes - Becho** — stored route coarse (300-point decimation) — rebuilt from OSM relation 13103549 (member-order); 300 → 574 points, 22.52 → 24.23 km, longest segment 1434 → 219 m. OSM ways joined across a gap of 3 m.
- **121 Mestia - Zabeshi** — stored route coarse (300-point decimation) — rebuilt from OSM relation 3818361 (graph); 83 → 479 points, 5.84 → 14.17 km, longest segment 245 → 163 m. identified by hand: relation 3818361 'Mestia - Zabeshi' (same name); the stored line covers 41% of it.
- **122 Mindazeebi village - Kikibo pastures (yaylas)** — stored route broken (jump of 4.6 km between consecutive points) — rebuilt from OSM relation 14916523 (member-order); 237 → 590 points, 33.09 → 46.41 km, longest segment 4594 → 582 m. identified by hand: relation 14916523 (same name); the stored line has a 4.6 km jump.
- **123 Mutso castle** — stored route coarse (300-point decimation) — rebuilt from OSM relation 17899815 (graph); 120 → 118 points, 1.12 → 0.73 km, longest segment 242 → 20 m.
- **124 N1 Tsvirmi - Ieli** — stored route coarse (300-point decimation) — rebuilt from OSM relation 13095213 (graph-longest-path); 300 → 300 points, 8.91 → 7.53 km, longest segment 625 → 148 m. side spurs of the relation not included: 788 m.
- **126 National Park Information Tail** — stored route coarse (300-point decimation) — rebuilt from OSM relation 3718445 (graph-lollipop); 91 → 112 points, 2.27 → 2.52 km, longest segment 107 → 66 m. side spurs of the relation not included: 116 m.
- **128 Oniore Waterfalls tourist trails** — stored route coarse (300-point decimation) — rebuilt from OSM relation 14222035 (graph); 300 → 534 points, 12.39 → 12.67 km, longest segment 173 → 144 m.
- **129 Path to King David's tower** — stored route coarse (300-point decimation) — rebuilt from OSM relation 18233310 (graph); 41 → 24 points, 1.11 → 0.58 km, longest segment 241 → 120 m.
- **130 Roshka - Juta** — stored route coarse (300-point decimation) — rebuilt from OSM relation 17899876 [Roshka (node/449219302, 214 m from the ways) → Juta (node/448929968, 11 m from the ways) on relation 17899876] (path-between-anchors); 300 → 576 points, 11.05 → 19.81 km, longest segment 134 → 201 m. identified by hand: relation 17899876 (formerly 'Roshka - Juta', now 'Chaukhi Pass Trail') between the two villages.
- **135 Tbilsi Hiking trail** — stored route coarse (300-point decimation) — rebuilt from OSM relation 15068997 (graph); 300 → 361 points, 8.68 → 5.09 km, longest segment 1332 → 115 m.
- **137 Tivasula fortress path** — stored route coarse (300-point decimation) — rebuilt from OSM relation 14078003 (graph); 159 → 141 points, 3.76 → 2.74 km, longest segment 761 → 83 m.
- **140 Transcaucasian Trail** — stored route broken (jump of 3.9 km between consecutive points) — rebuilt from OSM relation 19410123 (graph); 21 → 597 points, 7.53 → 143.53 km, longest segment 3906 → 1207 m. identified by hand: relation 19410123 'Transcaucasian Trail' (same name); the stored line has 21 points.
- **145 Tsvirmi - Zuruldi Ski Lift - Heshkili - Lemsia** — stored route coarse (300-point decimation) — rebuilt from OSM relation 13095214 (member-order); 300 → 596 points, 17.64 → 18.07 km, longest segment 233 → 155 m. OSM ways joined across a gap of 15 m.

## Existing trails that overlap (15 pairs)

Pairs where at least 80 % of one line lies within 100 m of the other (or the names are equal). Nothing was merged or removed; several are deliberate (a shorter stage of a longer trek, the same walk in the other direction) — decide by hand.

- 002 Mestia to Ushguli Trek ↔ 118 Mestia - Adishi: 26 % / 100 % overlap
- 002 Mestia to Ushguli Trek ↔ 121 Mestia - Zabeshi: 31 % / 100 % overlap
- 002 Mestia to Ushguli Trek ↔ 136 Tetnuldi Ski Resort - Adishi: 14 % / 100 % overlap
- 003 Juta to Roshka (Abudelauri Lakes) ↔ 008 Chaukhi Pass: 47 % / 100 % overlap
- 003 Juta to Roshka (Abudelauri Lakes) ↔ 130 Roshka - Juta: 100 % / 100 % overlap
- 004 Omalo to Dartlo ↔ 035 Atsunta Pass: 100 % / 20 % overlap
- 004 Omalo to Dartlo ↔ 146 Tusheti Omalo 2-3 Nights Round Trail: 89 % / 25 % overlap
- 008 Chaukhi Pass ↔ 130 Roshka - Juta: 100 % / 47 % overlap
- 011 Shatili to Mutso ↔ 035 Atsunta Pass: 100 % / 14 % overlap
- 013 Koruldi Lakes ↔ 120 Mestia - Koruldi Lakes - Becho: 100 % / 45 % overlap
- 021 Mazeri - Meziri Lake - Etseri ↔ 031 Etseri to Bak Pass: 45 % / 100 % overlap
- 028 Chvabiani to Adishi ↔ 136 Tetnuldi Ski Resort - Adishi: 64 % / 100 % overlap
- 048 Pure Pristine Forest Trail ↔ 140 Transcaucasian Trail: 82 % / 7 % overlap
- 118 Mestia - Adishi ↔ 121 Mestia - Zabeshi: 93 % / 79 % overlap
- 128 Oniore Waterfalls tourist trails ↔ 138 Toba-Oniore: 11 % / 100 % overlap

## Routes reversed (18)

The line was correct but ran against the trail name (e.g. "Etseri to Bak Pass" drawn from the pass down), which turned the climb into descent. Same points, opposite order.

- 007 Borjomi-Kharagauli: Likani Trail — starts near Likani (node/3874539210, 964 m from the ways) (set by hand)
- 013 Koruldi Lakes — Mestia Start is near the end; Koruldi Lakes is near the start
- 016 Mestia - Guli Pass - Mazeri — Mestia is near the end; Mestia is near the end; Mazeri Village is near the start; Mazeri is near the start
- 020 Zhabeshi to Tviberi Glacier — Zhabeshi Village is near the end; Zhabeshi is near the end; Tviberi Glacier is near the start; Tviberi Glacier is near the start
- 031 Etseri to Bak Pass — Etseri is near the end; Etseri is near the end; Bak Pass is near the start; Bak Pass is near the start
- 034 Gvirgvina Mountain Trail — Gvirgvina Summit is near the start
- 038 Diklo to Dartlo Red Trail — Diklo is near the end; Diklo is near the end; Dartlo is near the start
- 051 Mtatsminda to Narikala Fortress — Mtatsminda Park is near the end; Mtatsminda is near the end; Narikala Fortress is near the start; Narikala Fortress is near the start
- 055 Kiketi to Kabeni Monastery — Kiketi is near the end; Kiketi is near the end; Kabeni Monastery is near the start; Kabeni Monastery is near the start
- 103 Bak Pass - Mazeri — Mazeri End is near the start; Mazeri is near the start
- 107 Dolasvipi - Latali — Dolasvipi Start is near the end; Dolasvipi is near the end; Latali End is near the start; Latali is near the start
- 112 Jokolo => Duisi — Jokolo Start is near the end; Jokolo is near the end; Duisi End is near the start; Duisi is near the start
- 115 Lentekhi - Matskhvarishi — Lentekhi Start is near the end; Lentekhi is near the end
- 116 Mami - Latpri pass — Mami Start is near the end; Mami is near the end; Latpri pass End is near the start; Latpri pass is near the start
- 117 Mazeri - Hiker-Inn — Mazeri Start is near the end; Mazeri is near the end
- 121 Mestia - Zabeshi — Mestia Start is near the end; Mestia is near the end
- 124 N1 Tsvirmi - Ieli — N1 Tsvirmi Start is near the end; N1 Tsvirmi is near the end; Ieli End is near the start; Ieli is near the start
- 129 Path to King David's tower — King David's tower End is near the start; King David's tower is near the start

## Trails needing manual review (13)

Their stored route was kept untouched because it could not be rebuilt without guessing. Where the route is broken (jumps, a 2-point line, a fraction of the trail) distance, ascent, time and difficulty are **unverified** and were left as they were.

- **009 Martvili Canyon Trail** — stored route is broken (only 2 points covering 0.1 km of a 3 km trail) and could not be rebuilt — no OSM relation is known for this trail
- **010 Okatse Canyon Trail** — stored route is broken (only 2 points covering 0.3 km of a 7 km trail) and could not be rebuilt — override: the stored 2-point line lies about 13 km south-west of Okatse Canyon (near the Martvili/Okatse road junction) and no OSM relation exists for the canyon walk; the trail has to be drawn by hand
- **037 Omalo Round Trail** — stored route is broken (jump of 5.8 km between consecutive points) and could not be rebuilt — OSM relation cannot be turned into one clean line: relation 12211175: 2 disconnected parts; nearest remaining gap over 1 km (> 150 m)
- **041 Juta Waterfall and Lake** — stored route is broken (jump of 1.8 km between consecutive points) and could not be rebuilt — OSM relation cannot be turned into one clean line: relation 14205880: 2 disconnected parts; nearest remaining gap 266 m (> 150 m). Its elevation gain is still the synthetic distance × 60/40.
- **042 Arsha to Stepantsminda** — stored route is broken (jump of 3.5 km between consecutive points) and could not be rebuilt — OSM relation cannot be turned into one clean line: relation 14224776: 2 disconnected parts; nearest remaining gap over 1 km (> 150 m)
- **050 Sairme Pass Trail** — OSM relation cannot be turned into one clean line: relation 5576945: branches: longest line covers only 88% of the ways
- **116 Mami - Latpri pass** — OSM relation cannot be turned into one clean line: relation 15351831 is no longer in OSM
- **127 Omalo-Shatili** — stored route is broken (stored line is 11.4 km while the relation's ways add up to 49.2 km) and could not be rebuilt — OSM relation cannot be turned into one clean line: relation 12211099: 2 disconnected parts; nearest remaining gap over 1 km (> 150 m). Its elevation gain is still the synthetic distance × 60/40.
- **132 Samshvilde canyon trail** — stored route is broken (jump of 1.9 km between consecutive points) and could not be rebuilt — OSM relation cannot be turned into one clean line: relation 18919475: a loop with side branches adding up to 17% of the ways. Its elevation gain is still the synthetic distance × 60/40.
- **133 Snow Shoes Trail** — stored route is broken (jump of 2.8 km between consecutive points) and could not be rebuilt — OSM relation cannot be turned into one clean line: relation 5576796: the ways form several loops or parallel alternatives. Its elevation gain is still the synthetic distance × 60/40.
- **139 Trail 1: 19th c.** — OSM relation cannot be turned into one clean line: relation 6269165: the ways form several loops or parallel alternatives. Its elevation gain is still the synthetic distance × 60/40.
- **146 Tusheti Omalo 2-3 Nights Round Trail** — stored route is broken (jump of 2.2 km between consecutive points) and could not be rebuilt — stored route does not follow the mapped relation (1% of its points are on it). Its elevation gain is still the synthetic distance × 60/40.
- **147 Two Mountains Trail** — OSM relation cannot be turned into one clean line: relation 14119538: 2 disconnected parts; nearest remaining gap over 1 km (> 150 m). Its elevation gain is still the synthetic distance × 60/40.

## Difficulty changed on hand-curated trails (formula two or more levels away)

- 007 Borjomi-Kharagauli: Likani Trail: medium → **ultra** (effort 47.8)
- 017 Ushguli to Chvelpi: easy → **hard** (effort 32.5)
- 025 Okrostskali Lakes: medium → **ultra** (effort 59.9)
- 046 St. Andrews Trail: medium → **ultra** (effort 85.9)

## Region corrections

- 033 Shuano Mountain Trail: Svaneti → **Borjomi-Kharagauli** (Borjomi Municipality, Khashuri Municipality)
- 034 Gvirgvina Mountain Trail: Svaneti → **Borjomi-Kharagauli** (Borjomi Municipality, Khashuri Municipality)
- 044 Lagodekhi Yew Tree and Tbikeli Lake: Kakheti → **Adjara** (Kobuleti Municipality)
- 113 Kachou Fortress: Tusheti → **Khevsureti** (Dusheti Municipality)
- 123 Mutso castle: Tusheti → **Khevsureti** (Dusheti Municipality)
- 125 Nasabajvari trail: Imereti → **Borjomi-Kharagauli** (Adigeni Municipality, Baghdati Municipality)
- 128 Oniore Waterfalls tourist trails: Imereti → **Samegrelo** (Martvili Municipality)
- 131 Sairme pillars trail: Imereti → **Racha** (Tsageri Municipality)
- 132 Samshvilde canyon trail: Tbilisi → **Kvemo Kartli** (Tetritskaro Municipality)
- 138 Toba-Oniore: Imereti → **Samegrelo** (Martvili Municipality)

## Names and descriptions

- 106: "Dartlo–Kvavlo" → "Dartlo - Kvavlo"
- 112: "Jokolo => Duisi" → "Jokolo - Duisi"
- 126: "National Park Information Tail" → "National Park Information Trail"
- 135: "Tbilsi Hiking trail" → "Tbilisi Hiking trail"
- 139: "Trail 1: 19th c." → "Trail 1: 19th c"
- 044 Yew Tree and Tbikeli Lake: corrected by hand — the trail is in Adjara (Kintrishi), not in Lagodekhi: OSM relation 10543228 'Yew tree and lake Tbikeli'; the Georgian name joins the OSM names 'ხე უთხოვარი' and 'ტბიყელის ტბა' (the old one said Lagodekhi and beech)
- English descriptions written from the data for 45 trails whose description was a stub or wrong (where the trail starts and ends, distance, ascent, highest point, named OSM features within 150 m of the line). No facilities, views or safety claims were added.
- Georgian names filled for 11 trails (from OSM `name:ka` or joined from OSM toponyms); 37 existing trails still have none.

## Checkpoints

### Facilities that could not be confirmed (1) — now not checkable

No hut, spring or camp site of that kind is mapped in OpenStreetMap within 150 m of the route. Hikers must not count on these; please verify on the ground or remove them.

- **046 St. Andrews Trail — "St. Andrews Shelter" (shelter)**

### Moved checkpoints (150)

- 001 Gergeti Trinity Church — "Stepantsminda Trailhead": moved 2186 m: Stepantsminda (node/274262563) is 299 m from the route; start of the route
- 001 Gergeti Trinity Church — "Gergeti Trinity Church": moved 2467 m: Gergeti Trinity Church (way/122024199) is 11 m from the route
- 002 Mestia to Ushguli Trek — "Zhabeshi Village": moved 5880 m: Zhabeshi (node/478559533) is 35 m from the route
- 002 Mestia to Ushguli Trek — "Adishi Village": moved 3791 m: Adishi (node/478551574) is 123 m from the route
- 002 Mestia to Ushguli Trek — "Ushguli": moved 4319 m: Ushguli (node/1855444526) is 607 m from the route
- 003 Juta to Roshka (Abudelauri Lakes) — "Juta Village Trailhead": moved 8148 m: Juta (node/448929968) is 26 m from the route; start of the route
- 003 Juta to Roshka (Abudelauri Lakes) — "Chaukhi Pass": moved 3323 m: Chaukhi Pass (node/864622575) is 0 m from the route
- 003 Juta to Roshka (Abudelauri Lakes) — "Abudelauri Lakes Area": moved 5058 m: Abudelauri Blue Lake (relation/17805724) is 13 m from the route
- 003 Juta to Roshka (Abudelauri Lakes) — "Roshka Village": moved 3302 m: Roshka (node/449219302) is 221 m from the route
- 004 Omalo to Dartlo — "Omalo Fortress": moved 1677 m: Upper Omalo (node/308486883) is 8 m from the route; start of the route
- 004 Omalo to Dartlo — "Dartlo Village": moved 15164 m: Dartlo (node/449209837) is 134 m from the route
- 005 Truso Valley — "Truso Valley Entrance": moved 5583 m: Truso Valley (node/4250087306) is 10 m from the route; start of the route
- 005 Truso Valley — "Travertine Pools": moved 8711 m: Travertine spring (node/6600250885) is 46 m from the route
- 005 Truso Valley — "Abandoned Village Ketrisi": moved 8349 m: Ketrisi (node/3015676534) is 26 m from the route
- 005 Truso Valley — "Zakagori Fortress": moved 15558 m: Zakagori Fortress (way/716821999) is 58 m from the route
- 007 Borjomi-Kharagauli: Likani Trail — "Likani Park Entrance": moved 13102 m: Likani (node/3874539210) is 964 m from the route; start of the route
- 007 Borjomi-Kharagauli: Likani Trail — "Forest Shelter": moved 159 m to the mapped hut node/11955924874
- 008 Chaukhi Pass — "Juta Approach": moved 8148 m: Juta (node/448929968) is 26 m from the route; start of the route
- 008 Chaukhi Pass — "Chaukhi Rock Spires Base": moved 6469 m: Chaukhi Lake (way/488543944) is 99 m from the route
- 008 Chaukhi Pass — "Chaukhi Pass Summit 3338m": moved 4035 m: Chaukhi Pass (node/864622575) is 0 m from the route
- 011 Shatili to Mutso — "Shatili Fortress": moved 7037 m: Shatili (node/430738640) is 130 m from the route; start of the route
- 011 Shatili to Mutso — "Mutso Fortress": moved 7081 m: Mutso Fortress (node/7908362591) is 140 m from the route
- 012 Tobavarchkhili (Silver Lake) — "Tobavarchkhili (Silver Lake)": moved 13035 m: Toba-Varchkhili (way/51067848) is 70 m from the route
- 012 Tobavarchkhili (Silver Lake) — "Forest Camp": moved 10931 m to the mapped camp node/12163636439
- 012 Tobavarchkhili (Silver Lake) — "Skuri End Point": moved 10147 m: Skuri (node/403808904) is 79 m from the route
- 013 Koruldi Lakes — "Mestia Start": moved 324 m: Mestia (node/375730929) is 474 m from the route; start of the route
- 013 Koruldi Lakes — "Koruldi Lakes": moved 4924 m: Koruldi Lake (way/243319756) is 18 m from the route
- 014 Mestia to Chalaadi Glacier — "Chalaadi Glacier": moved 191 m: Chaladi Glacier (relation/5498394) is 72 m from the route
- 015 Mazeri to Ushba Glacier — "Mazeri Village": moved 2902 m: Panoramic view to Mazeri (Shdugra) waterfall (node/4437663534) is 139 m from the route
- 016 Mestia - Guli Pass - Mazeri — "Mestia": moved 3609 m: Mestia (node/375730929) is 36 m from the route; start of the route
- 016 Mestia - Guli Pass - Mazeri — "Guli Pass": moved 1331 m: Gulichala Pass (node/1905990324) is 0 m from the route
- 016 Mestia - Guli Pass - Mazeri — "Mazeri Village": moved 8463 m: Mazeri (node/478560253) is 121 m from the route
- 017 Ushguli to Chvelpi — "Chvelpi": moved 660 m: Chvelpi (node/478639388) is 331 m from the route
- 018 Ushguli to Shkhara Glacier — "Shkhara Glacier": moved 438 m: Shkhara Glacier (way/174901570) is 46 m from the route
- 019 Laila Glacier Trail — "Trailhead": start of the rebuilt route
- 019 Laila Glacier Trail — "Laila Glacier": moved 266 m: Laila north pass (node/5631334648) is 1184 m from the route
- 020 Zhabeshi to Tviberi Glacier — "Zhabeshi Village": moved 6505 m: Zhabeshi (node/478559533) is 452 m from the route; start of the route
- 020 Zhabeshi to Tviberi Glacier — "Tviberi Glacier": moved 5861 m: Tviberi Glacier (way/290484177) is 694 m from the route
- 021 Mazeri - Meziri Lake - Etseri — "Meziri Lake": moved 3001 m: Mezir (way/420880628) is 68 m from the route
- 021 Mazeri - Meziri Lake - Etseri — "Etseri": moved 250 m: Etseri (node/9850973564) is 99 m from the route
- 022 Mestia - Hatsvali - Zuruldi — "Hatsvali": moved 548 m: Hatsvali (node/1766059508) is 155 m from the route
- 023 Mount Laila Traverse — "Laila Base": moved 242 m to the mapped camp node/14102992068
- 023 Mount Laila Traverse — "Mananauri": moved 2519 m: Mananauri (node/478639435) is 57 m from the route
- 024 Khaishi to Lakumura Lake — "Khaishi": moved 2 m: Khaishi (node/478728985) is 116 m from the route; start of the route
- 026 Lake Memuli — "Lake Memuli": moved 638 m: Memuli  Lake - 2 (relation/5316454) is 67 m from the route
- 028 Chvabiani to Adishi — "Adishi": moved 626 m: Adishi (node/478551574) is 126 m from the route
- 029 Kala to Latpari Pass — "Latpari Pass": moved 563 m: Latpari Pass (node/1610897074) is 0 m from the route
- 031 Etseri to Bak Pass — "Etseri": moved 5570 m: Etseri (node/9850973564) is 100 m from the route; start of the route
- 031 Etseri to Bak Pass — "Bak Pass": moved 4732 m: Baki (node/4273193189) is 0 m from the route
- 032 Leiraki Waterfall Trail — "Leiraki Waterfall": moved 2482 m: Leiraki waterfall (node/1711400627) is 201 m from the route
- 033 Shuano Mountain Trail — "Shuano Summit": moved 7223 m: Shuano-Mta (node/5836218372) is 429 m from the route
- 034 Gvirgvina Mountain Trail — "Trailhead": start of the route (the route now runs in the direction of the trail name)
- 034 Gvirgvina Mountain Trail — "Gvirgvina Summit": moved 4937 m: Gvirgvina (node/11626740419) is 33 m from the route
- 035 Atsunta Pass — "Omalo": moved 34368 m: Upper Omalo (node/308486883) is 8 m from the route; start of the route
- 035 Atsunta Pass — "Atsunta Pass 3431m": moved 5056 m: Atsunta Pass (node/2549850584) is 0 m from the route
- 035 Atsunta Pass — "Shatili": moved 11290 m: Shatili (node/430738640) is 130 m from the route
- 036 Omalo to Diklo — "Omalo": moved 6321 m: Omalo (node/826106795) is 10 m from the route; start of the route
- 036 Omalo to Diklo — "Diklo Village": moved 5250 m: Diklo (node/449209833) is 214 m from the route
- 037 Omalo Round Trail — "Dochu": moved 1068 m: Dochu (node/449209835) is 1 m from the route
- 037 Omalo Round Trail — "Bochorma": moved 4144 m: Bochorna (node/3084298006) is 25 m from the route
- 037 Omalo Round Trail — "Khakhabo": moved 2948 m: Khakhabo Bridge (ruined by water in 2024) (way/566379528) is 3 m from the route
- 038 Diklo to Dartlo Red Trail — "Diklo": moved 7032 m: Diklo (node/449209833) is 734 m from the route; start of the route
- 038 Diklo to Dartlo Red Trail — "Chigho": moved 44 m: Chigho (node/7908656480) is 35 m from the route
- 038 Diklo to Dartlo Red Trail — "Dartlo": moved 9081 m: Dartlo (node/449209837) is 34 m from the route
- 039 Omalo to Nakle Kholi Pass — "Omalo": start of the rebuilt route
- 039 Omalo to Nakle Kholi Pass — "Nakle Kholi Pass": moved 496 m: Nakaicho (Nakle-Kholi) Pass (node/2910875041) is 0 m from the route
- 040 Oreti Lake Hike — "Start": start of the rebuilt route
- 040 Oreti Lake Hike — "Oreti Lake": moved 701 m: Oreti Lake (way/341391064) is 8 m from the route
- 041 Juta Waterfall and Lake — "Juta Village": moved 3324 m: Juta (node/448929968) is 147 m from the route
- 042 Arsha to Stepantsminda — "Arsha": moved 5081 m: Arsha fortress (node/12520773558) is 866 m from the route
- 042 Arsha to Stepantsminda — "Stepantsminda": moved 6027 m: Stepantsminda (node/274262563) is 183 m from the route
- 043 Lagodekhi Black Rock Lake — "Black Rock Lake": moved 9663 m: Lake Grdzeli (Lake Khala-Khel, Black Rock Lake) (way/40500696) is 71 m from the route
- 044 Yew Tree and Tbikeli Lake — "Lake Tbikeli": moved 716 m: Tbikeli Lake (way/519491560) is 85 m from the route
- 047 Shepherds Trail — "Shepherd Shelter": moved 3383 m: Abandoned shepherds hut (no doors) (node/5250984715) is 15 m from the route
- 050 Sairme Pass Trail — "Sairme Pass": moved 3831 m: Sairme Pass (node/11758753137) is 26 m from the route
- 051 Mtatsminda to Narikala Fortress — "Mtatsminda Park": moved 23 m: Mtatsminda (node/1650325626) is 679 m from the route; start of the route
- 051 Mtatsminda to Narikala Fortress — "Narikala Fortress": moved 147 m: Narikala (relation/9820020) is 121 m from the route
- 052 Tbilisi National Park Trail — "Park Entrance": start of the rebuilt route
- 053 Mtatsminda to Kojori — "Kojori": moved 673 m: Kojori (node/312934058) is 565 m from the route
- 054 Betania to Kveseti — "Betania Monastery": moved 3679 m: Betania Monastery of the Nativity of the Mother of God (way/1321501893) is 49 m from the route
- 054 Betania to Kveseti — "Kveseti": moved 1516 m: Kveseti (node/310183295) is 134 m from the route
- 055 Kiketi to Kabeni Monastery — "Kiketi": moved 2109 m: Kiketi (node/311280672) is 582 m from the route; start of the route
- 055 Kiketi to Kabeni Monastery — "Kabeni Monastery": moved 1998 m: Kabeni monastery (way/582911302) is 233 m from the route
- 056 Kojori to Kabeni Waterfalls — "Kojori": start of the rebuilt route
- 100 Adishi - Iprali — "Adishi Start": start of the route
- 100 Adishi - Iprali — "Iprali End": end of the route (was placed at 95% of the old point list)
- 101 Adventure track — "End": end of the route (was placed at 95% of the old point list)
- 102 Bak Pass - Dolasvipi — "Dolasvipi End": end of the route (was placed at 95% of the old point list)
- 103 Bak Pass - Mazeri — "Bak Pass Start": start of the route
- 103 Bak Pass - Mazeri — "Mazeri End": end of the route (was placed at 95% of the old point list)
- 104 Black — "End": end of the route (was placed at 95% of the old point list)
- 105 Children Learning Track — "End": end of the route (was placed at 95% of the old point list)
- 106 Dartlo - Kvavlo — "Kvavlo End": end of the route (was placed at 95% of the old point list)
- 107 Dolasvipi - Latali — "Dolasvipi Start": start of the route
- 107 Dolasvipi - Latali — "Latali End": end of the route (was placed at 95% of the old point list)
- 108 Ebudi - Dolasvipi — "Dolasvipi End": end of the route (was placed at 95% of the old point list)
- 109 Gulebi Fortress route — "End": end of the route (was placed at 95% of the old point list)
- 110 Guli glacier and Ushba base path — "End": end of the route (was placed at 95% of the old point list)
- 111 Iprari - Ushguli — "Ushguli End": end of the route (was placed at 95% of the old point list)
- 112 Jokolo - Duisi — "Jokolo Start": start of the route
- 112 Jokolo - Duisi — "Duisi End": end of the route (was placed at 95% of the old point list)
- 113 Kachou Fortress — "Start": start of the route
- 113 Kachou Fortress — "End": end of the route (was placed at 95% of the old point list)
- 114 Khikhadziri village - Shuamta lakes - Khikhani fortress — "Khikhadziri village Start": start of the route
- 114 Khikhadziri village - Shuamta lakes - Khikhani fortress — "Khikhani fortress End": end of the route (was placed at 95% of the old point list)
- 115 Lentekhi - Matskhvarishi — "Lentekhi Start": start of the route
- 115 Lentekhi - Matskhvarishi — "Matskhvarishi End": end of the route (was placed at 95% of the old point list)
- 116 Mami - Latpri pass — "Mami Start": start of the route
- 116 Mami - Latpri pass — "Latpri pass End": end of the route (was placed at 95% of the old point list)
- 117 Mazeri - Hiker-Inn — "Mazeri Start": start of the route
- 117 Mazeri - Hiker-Inn — "Hiker-Inn End": end of the route (was placed at 95% of the old point list)
- 118 Mestia - Adishi — "Adishi End": end of the route (was placed at 95% of the old point list)
- 119 Mestia - Heshkili - Ieli - Tsvirmi - Tetnuldi Ski Lift — "Tetnuldi Ski Lift End": end of the route (was placed at 95% of the old point list)
- 120 Mestia - Koruldi Lakes - Becho — "Becho End": end of the route (was placed at 95% of the old point list)
- 121 Mestia - Zabeshi — "Mestia Start": start of the route
- 121 Mestia - Zabeshi — "Zabeshi End": end of the route (was placed at 95% of the old point list)
- 122 Mindazeebi village - Kikibo pastures (yaylas) — "Kikibo pastures End": end of the route (was placed at 95% of the old point list)
- 123 Mutso castle — "Start": start of the route
- 123 Mutso castle — "End": end of the route (was placed at 95% of the old point list)
- 124 N1 Tsvirmi - Ieli — "N1 Tsvirmi Start": start of the route
- 124 N1 Tsvirmi - Ieli — "Ieli End": end of the route (was placed at 95% of the old point list)
- 125 Nasabajvari trail — "End": end of the route (was placed at 95% of the old point list)
- 126 National Park Information Trail — "Start": start of the route
- 126 National Park Information Trail — "End": end of the route (was placed at 95% of the old point list)
- 127 Omalo-Shatili — "Start": start of the route
- 127 Omalo-Shatili — "End": end of the route (was placed at 95% of the old point list)
- 128 Oniore Waterfalls tourist trails — "End": end of the route (was placed at 95% of the old point list)
- 129 Path to King David's tower — "Path Start": start of the route
- 129 Path to King David's tower — "King David's tower End": end of the route (was placed at 95% of the old point list)
- 130 Roshka - Juta — "Roshka Start": start of the route
- 130 Roshka - Juta — "Juta End": end of the route (was placed at 95% of the old point list)
- 131 Sairme pillars trail — "End": end of the route (was placed at 95% of the old point list)
- 132 Samshvilde canyon trail — "End": end of the route (was placed at 95% of the old point list)
- 133 Snow Shoes Trail — "End": end of the route (was placed at 95% of the old point list)
- 134 Sulda Wetland — "End": end of the route (was placed at 95% of the old point list)
- 135 Tbilisi Hiking trail — "End": end of the route (was placed at 95% of the old point list)
- 136 Tetnuldi Ski Resort - Adishi — "Adishi End": end of the route (was placed at 95% of the old point list)
- 137 Tivasula fortress path — "End": end of the route (was placed at 95% of the old point list)
- 138 Toba-Oniore — "End": end of the route (was placed at 95% of the old point list)
- 139 Trail 1: 19th c — "Start": start of the route
- 139 Trail 1: 19th c — "End": end of the route (was placed at 95% of the old point list)
- 140 Transcaucasian Trail — "End": end of the route (was placed at 95% of the old point list)
- 141 Transcaucasian Trail: Upper Svaneti 2 (Alternate) — "End": end of the route (was placed at 95% of the old point list)
- 142 Transcaucasian Trail: Upper Svaneti 4 (Alternate) — "End": end of the route (was placed at 95% of the old point list)
- 143 Tsaleri - Kichkhuldashi — "Kichkhuldashi End": end of the route (was placed at 95% of the old point list)
- 144 Tsaleri - mount Kva - Place Zagari — "Place Zagari End": end of the route (was placed at 95% of the old point list)
- 145 Tsvirmi - Zuruldi Ski Lift - Heshkili - Lemsia — "Lemsia End": end of the route (was placed at 95% of the old point list)
- 146 Tusheti Omalo 2-3 Nights Round Trail — "End": end of the route (was placed at 95% of the old point list)
- 147 Two Mountains Trail — "End": end of the route (was placed at 95% of the old point list)
- 148 Ushkhvanari - Latali — "Latali End": end of the route (was placed at 95% of the old point list)

### Other checkpoints made not checkable (8)

- 004 Omalo to Dartlo — "Tusheti Valley Viewpoint": 5417 m from the route
- 006 Ninoskhevi Waterfall — "Lagodekhi Visitor Center": 5023 m from the route
- 006 Ninoskhevi Waterfall — "Forest Bridge": 3783 m from the route
- 006 Ninoskhevi Waterfall — "Black Grouse Waterfall": 3841 m from the route
- 009 Martvili Canyon Trail — "Canyon Viewpoint": 1933 m from the route
- 010 Okatse Canyon Trail — "Okatse Trailhead": 354 m from the route
- 010 Okatse Canyon Trail — "Suspended Walkway": 6042 m from the route
- 056 Kojori to Kabeni Waterfalls — "Kabeni Waterfalls": 597 m from the route

### Positions that could not be verified (35, left in place)

Generic labels ("Switchback Viewpoint", "Forest Bridge", "Panorama Point", …) that match no named OSM feature. They still sit on the route at the fraction of its length where the original import put them.

001 "Switchback Viewpoint" · 002 "Iprali Pass" · 004 "Tusheti Valley Viewpoint" · 006 "Lagodekhi Visitor Center" · 006 "Forest Bridge" · 006 "Black Grouse Waterfall" · 007 "Alpine Meadow Viewpoint" · 007 "Romanoff Trail Summit" · 009 "Canyon Viewpoint" · 010 "Okatse Trailhead" · 010 "Suspended Walkway" · 011 "Argun Gorge Viewpoint" · 015 "Ushba Glacier Viewpoint" · 022 "Zuruldi" · 024 "Lakumura Lake" · 025 "Small Lake" · 025 "Big Lake" · 026 "Start" · 027 "Mheer Church" · 030 "Cross Viewpoint" · 032 "Start" · 041 "Waterfall" · 041 "Alpine Lake" · 043 "Lagodekhi Visitor Center" · 044 "Ancient Yew Tree" · 045 "Panorama Point" · 045 "End" · 046 "Start" · 046 "End" · 048 "Forest Entrance" · 048 "Old Growth Forest" · 049 "Wildlife Area" · 050 "Start" · 052 "Forest Viewpoint" · 056 "Kabeni Waterfalls"

## New trails (85)

Accepted only if: usable name; members stitch into one continuous line (gaps ≤ 150 m); 2–120 km; entirely inside Georgian-controlled territory and at least 1 km from the occupation line; not a duplicate or variant (≥ 80 % of the line along an existing or longer new trail, or same ends ±300 m and length ±15 %); DEM data available. Ids are RFC 4122 v5 UUIDs of `osm-relation-<id>`. Values are measured/derived as above; checkpoints are Start, End and named OSM features within 150 m of the line, at their real positions.

| Trail | OSM relation | region | km | ascent m | max m | hours | difficulty | checkpoints | notes |
|---|---|---|---|---|---|---|---|---|---|
| Upper Krikhi | [6535360](https://www.openstreetmap.org/relation/6535360) | Racha | 9.7 | 303 | 1020 | 3.5 | medium | 5 |  |
| Sadmeli - Ritseuli Trail<br>სადმელი - რიცეული | [6535373](https://www.openstreetmap.org/relation/6535373) | Racha | 14.9 | 549 | 1028 | 5 | medium | 4 |  |
| Chelishi Trail<br>ჩელიში | [6535480](https://www.openstreetmap.org/relation/6535480) | Racha | 3.9 | 14 | 1223 | 1 | easy | 3 |  |
| Arkhotistavi Pass Trail | [10485719](https://www.openstreetmap.org/relation/10485719) | Khevsureti | 21.7 | 1493 | 3280 | 10 | ultra | 5 | side spurs of the relation not included: 45 m |
| Tanie Trail | [10485720](https://www.openstreetmap.org/relation/10485720) | Khevsureti | 14.7 | 1102 | 3044 | 7.5 | ultra | 4 | OSM says the route has no trail markers |
| Isartgele Pass Trail | [10485721](https://www.openstreetmap.org/relation/10485721) | Khevsureti | 15.1 | 1902 | 3545 | 11.5 | ultra | 4 | OSM says the route has no trail markers |
| Assa Trail | [10485957](https://www.openstreetmap.org/relation/10485957) | Khevsureti | 12.6 | 343 | 1969 | 4 | medium | 4 | OSM says the route has no trail markers |
| Datvijvari - Roshka | [10491436](https://www.openstreetmap.org/relation/10491436) | Khevsureti | 20.3 | 990 | 2980 | 9 | hard | 4 |  |
| Ardoti - Khidotani | [10492407](https://www.openstreetmap.org/relation/10492407) | Khevsureti | 3 | 653 | 2486 | 2.5 | easy | 2 |  |
| Chanchakhistskali Trail | [10492492](https://www.openstreetmap.org/relation/10492492) | Khevsureti | 15.5 | 1326 | 2908 | 6.5 | hard | 2 |  |
| Sadzele Pass Trail | [10495588](https://www.openstreetmap.org/relation/10495588) | Khevsureti | 10.1 | 1069 | 3057 | 5.5 | hard | 3 | region taken from the start (start Khevsureti, middle Mtskheta-Mtianeti) |
| Roshka Trail | [10495589](https://www.openstreetmap.org/relation/10495589) | Khevsureti | 7.3 | 558 | 1979 | 3 | medium | 2 | OSM says the route has no trail markers |
| Gudani - Ukankhadu<br>გუდანი - უკანხადუ | [10495634](https://www.openstreetmap.org/relation/10495634) | Khevsureti | 11.8 | 584 | 1951 | 4 | medium | 4 |  |
| Shatili - Kistani<br>შატილი - კისტანი | [10495652](https://www.openstreetmap.org/relation/10495652) | Khevsureti | 14.3 | 620 | 2026 | 4.5 | medium | 5 | OSM says the route has no trail markers |
| Main Ridge Trail | [10495654](https://www.openstreetmap.org/relation/10495654) | Khevsureti | 27.9 | 1539 | 3143 | 11 | ultra | 8 | OSM says the route has no trail markers |
| Gudani Trail | [10506194](https://www.openstreetmap.org/relation/10506194) | Khevsureti | 8.3 | 553 | 2152 | 4 | medium | 3 |  |
| Atabe - Kistani<br>ატაბე - კისტანი | [10506196](https://www.openstreetmap.org/relation/10506196) | Khevsureti | 16.7 | 1308 | 3053 | 8.5 | ultra | 5 | OSM says the route has no trail markers |
| Mutso - Andaki<br>მუცო - ანდაქი | [10506201](https://www.openstreetmap.org/relation/10506201) | Khevsureti | 9.6 | 335 | 1840 | 3 | medium | 2 |  |
| Gogrulta - Khakhabo | [10506209](https://www.openstreetmap.org/relation/10506209) | Tusheti | 7.8 | 724 | 2558 | 5 | medium | 2 |  |
| Omalo - Khakhabo | [10534768](https://www.openstreetmap.org/relation/10534768) | Tusheti | 3 | 324 | 2027 | 2 | easy | 2 |  |
| Dochu - Gogrulta<br>დოჭუ - გოგლურთა | [10534774](https://www.openstreetmap.org/relation/10534774) | Tusheti | 2.5 | 352 | 2123 | 2 | easy | 2 | side spurs of the relation not included: 58 m |
| Stepantsminda - Kazbegi | [10534819](https://www.openstreetmap.org/relation/10534819) | Kazbegi | 5.2 | 839 | 2997 | 3.5 | medium | 5 |  |
| Kuakantsalia Trail | [12411378](https://www.openstreetmap.org/relation/12411378) | Samegrelo | 29 | 1696 | 2022 | 12.5 | ultra | 6 | side spurs of the relation not included: 326 m |
| TCT Chuberi to Nakra | [13703281](https://www.openstreetmap.org/relation/13703281) | Svaneti | 29.5 | 1956 | 2712 | 13.5 | ultra | 7 |  |
| TCT Nakra to Becho | [13703282](https://www.openstreetmap.org/relation/13703282) | Svaneti | 33.8 | 2198 | 2458 | 15 | ultra | 10 |  |
| Akhaldaba - Betania monastery | [13712566](https://www.openstreetmap.org/relation/13712566) | Tbilisi | 13.3 | 801 | 1422 | 5 | medium | 3 |  |
| Gonio Cross Hike | [14078802](https://www.openstreetmap.org/relation/14078802) | Adjara | 6.8 | 292 | 301 | 2.5 | easy | 3 | side spurs of the relation not included: 672 m |
| Khadori - Makhvali Waterfall<br>ხადორი - მახვალის ჩანჩქერი | [14195682](https://www.openstreetmap.org/relation/14195682) | Kakheti | 3.3 | 377 | 1250 | 1.5 | easy | 2 |  |
| Khabelashvilebi-Jvari Mindori - Peranga-Tskhemlisi | [14384533](https://www.openstreetmap.org/relation/14384533) | Adjara | 34.1 | 1739 | 2509 | 14 | ultra | 5 |  |
| Khabelashvilebi-Jvari Mindori - Tbikeli Lake - Kintrishi | [14384534](https://www.openstreetmap.org/relation/14384534) | Adjara | 39.3 | 2256 | 2508 | 16.5 | ultra | 7 |  |
| Gobroneti Circular-Hiking | [14884461](https://www.openstreetmap.org/relation/14884461) | Adjara | 17.1 | 1133 | 1320 | 7 | hard | 2 | OSM marks it as a round trip; the line is one way (walk back the same way) |
| TCT Imereti to Racha | [14995924](https://www.openstreetmap.org/relation/14995924) | Racha | 69.3 | 2549 | 2350 | 24 | ultra | 9 | region taken from the start (start Racha, middle Imereti); passes within 2.9 km of the occupation line |
| Armazi - Armazi Fortress<br>არმაზი - არმაზის ციხე | [15095553](https://www.openstreetmap.org/relation/15095553) | Tbilisi | 2.1 | 255 | 729 | 1 | easy | 3 |  |
| Kojori - Asureti<br>კოჯორი - ასურეთი | [15407539](https://www.openstreetmap.org/relation/15407539) | Tbilisi | 13.7 | 207 | 1283 | 4.5 | medium | 4 |  |
| Zeskho - Ghebi<br>ზესხო - ღები | [15412627](https://www.openstreetmap.org/relation/15412627) | Svaneti | 41.4 | 1829 | 2904 | 16 | ultra | 8 | region taken from the start (start Svaneti, middle Racha) |
| Likheti - Shkedi<br>ლიხეთი - შკედი | [15412745](https://www.openstreetmap.org/relation/15412745) | Racha | 32.1 | 2473 | 3026 | 16 | ultra | 7 |  |
| Gogrulta - Birkiani Trail | [15429964](https://www.openstreetmap.org/relation/15429964) | Tusheti | 45.6 | 2063 | 3153 | 19.5 | ultra | 3 |  |
| Mokoland | [15656855](https://www.openstreetmap.org/relation/15656855) | Tbilisi | 3.6 | 94 | 1101 | 1 | easy | 2 |  |
| Lower Sharakhevi - Khmala Mountain - Bodakhevi | [15656895](https://www.openstreetmap.org/relation/15656895) | Mtskheta-Mtianeti | 17.6 | 1326 | 2165 | 8.5 | hard | 2 |  |
| Round hiking trail in Tana gorge | [15656918](https://www.openstreetmap.org/relation/15656918) | Shida Kartli | 10.5 | 619 | 1352 | 4.5 | medium | 3 |  |
| Vardzia Tmgovi | [15670216](https://www.openstreetmap.org/relation/15670216) | Samtskhe-Javakheti | 4.4 | 195 | 1397 | 1.5 | easy | 2 |  |
| Kutaisi - Sataplia - Gumati<br>ქუთაისი - სათაფლია - გუმათი | [16050511](https://www.openstreetmap.org/relation/16050511) | Imereti | 11 | 353 | 408 | 3.5 | medium | 3 |  |
| Didgori - Chili lake - Telovani<br>დიდგორი - ჭილის ტბა - თელოვანი | [16098291](https://www.openstreetmap.org/relation/16098291) | Tbilisi | 7.7 | 413 | 1261 | 3 | easy | 4 |  |
| Shaori Reservoir - Village of Mukhura<br>შაორის წყალსაცავი - სოფ. მუხურა | [17571018](https://www.openstreetmap.org/relation/17571018) | Racha | 22.9 | 645 | 1756 | 8 | hard | 3 |  |
| Djvarboseli - Alaznistavi | [17899903](https://www.openstreetmap.org/relation/17899903) | Tusheti | 22.5 | 1036 | 2441 | 8 | hard | 4 | OSM says the route has no trail markers |
| Shepherds trail (by ridge) | [18160416](https://www.openstreetmap.org/relation/18160416) | Borjomi-Kharagauli | 6.9 | 516 | 2263 | 3 | medium | 3 |  |
| Tsriokhi Fortress trail | [18187273](https://www.openstreetmap.org/relation/18187273) | Samtskhe-Javakheti | 11.7 | 529 | 1324 | 4.5 | medium | 5 |  |
| Trail to Gorijvari | [18193774](https://www.openstreetmap.org/relation/18193774) | Shida Kartli | 2.7 | 217 | 818 | 1 | easy | 3 |  |
| Gorinamkali trail | [18234609](https://www.openstreetmap.org/relation/18234609) | Shida Kartli | 2.6 | 693 | 1668 | 2.5 | easy | 2 |  |
| Adjameti trail route<br>აჯამეთის ბილიკის მარშრუტი | [18611857](https://www.openstreetmap.org/relation/18611857) | Imereti | 33.5 | 151 | 201 | 9 | hard | 2 |  |
| Adjameti Circular<br>აჯამეთის ბილიკის მარშრუტი | [18611858](https://www.openstreetmap.org/relation/18611858) | Imereti | 13.3 | 47 | 156 | 3.5 | medium | 2 |  |
| Path to Khvamli mountain | [19024909](https://www.openstreetmap.org/relation/19024909) | Racha | 13.8 | 1542 | 1841 | 7 | hard | 4 |  |
| Cross Mountain | [19253361](https://www.openstreetmap.org/relation/19253361) | Borjomi-Kharagauli | 4.5 | 330 | 1130 | 2.5 | easy | 5 |  |
| Abastumani-Jaji lake | [19282454](https://www.openstreetmap.org/relation/19282454) | Samtskhe-Javakheti | 19.6 | 352 | 2793 | 7 | medium | 4 | region taken from the start (start Samtskhe-Javakheti, middle Borjomi-Kharagauli) |
| Kartsachi Lake | [19282624](https://www.openstreetmap.org/relation/19282624) | Samtskhe-Javakheti | 6.9 | 118 | 1905 | 2 | easy | 2 |  |
| Jaji lake-Ukhuti | [19305836](https://www.openstreetmap.org/relation/19305836) | Imereti | 37 | 2590 | 2745 | 14 | ultra | 3 |  |
| Baratkhevi Trail | [19307461](https://www.openstreetmap.org/relation/19307461) | Borjomi-Kharagauli | 13.6 | 971 | 2313 | 5 | medium | 4 |  |
| Vartsikhe Ajameti Park | [20736830](https://www.openstreetmap.org/relation/20736830) | Imereti | 7.9 | 27 | 137 | 2 | easy | 2 |  |
| Along the river Rioni | [20737053](https://www.openstreetmap.org/relation/20737053) | Imereti | 15.7 | 137 | 214 | 4.5 | medium | 8 | OSM marks it as a round trip; the line is one way (walk back the same way) |
| Kutaisi-Motsameta Monastery - Kutaisi | [20737079](https://www.openstreetmap.org/relation/20737079) | Imereti | 9.9 | 174 | 333 | 3 | easy | 6 |  |
| Gogrulta - Iliurta<br>გოგლურთა - ილიურთა | [20770311](https://www.openstreetmap.org/relation/20770311) | Tusheti | 6.7 | 320 | 2396 | 2.5 | easy | 4 |  |
| Beghela - Iliurta<br>ბეღელა - ილიურთა | [20770312](https://www.openstreetmap.org/relation/20770312) | Tusheti | 3.5 | 264 | 2103 | 1.5 | easy | 2 |  |
| Shenako - Ageurta - Tatikboselthana<br>შენაქო - აგეურთა - ტატიკბოსელთანა | [21146016](https://www.openstreetmap.org/relation/21146016) | Tusheti | 2.8 | 37 | 1920 | 1 | easy | 2 |  |
| Nakaicho Pass Trail | [21148080](https://www.openstreetmap.org/relation/21148080) | Tusheti | 6 | 961 | 2925 | 4 | medium | 2 |  |
| Kaduina Pass Trail | [21148312](https://www.openstreetmap.org/relation/21148312) | Tusheti | 11.8 | 1107 | 3170 | 7 | hard | 3 |  |
| Verkhovani - Indurta<br>ვერხოვანი - ინდურთა | [21148313](https://www.openstreetmap.org/relation/21148313) | Tusheti | 7 | 246 | 2052 | 2.5 | easy | 2 | OSM says the route has no trail markers |
| Artani - Alavani Trail | [21148567](https://www.openstreetmap.org/relation/21148567) | Tusheti | 18.3 | 1107 | 2951 | 9 | hard | 5 |  |
| Chalakhevi - Dzvibakhevi Trail | [21148569](https://www.openstreetmap.org/relation/21148569) | Kakheti | 16.2 | 17 | 2049 | 5.5 | medium | 3 |  |
| Chanchakhi Pass Trail | [21149078](https://www.openstreetmap.org/relation/21149078) | Khevsureti | 4.1 | 374 | 2857 | 2.5 | easy | 3 | OSM says the route has no trail markers |
| Roshka - Akhieli | [21149810](https://www.openstreetmap.org/relation/21149810) | Khevsureti | 15.3 | 985 | 2972 | 6 | hard | 3 | OSM says the route has no trail markers |
| Suatisi and Mna Gorge | [21164580](https://www.openstreetmap.org/relation/21164580) | Kazbegi | 24.1 | 1167 | 3374 | 9.5 | ultra | 3 | OSM says the route has no trail markers; side spurs of the relation not included: 335 m |
| Omalo - Artana (Tsokalta - Artana) | [21165430](https://www.openstreetmap.org/relation/21165430) | Tusheti | 57.5 | 3558 | 3076 | 28.5 | ultra | 4 | region taken from the start (start Tusheti, middle Kakheti); side spurs of the relation not included: 1281 m |
| Omalo - Artana (Omalo - Tsokalta) | [21165516](https://www.openstreetmap.org/relation/21165516) | Tusheti | 6 | 105 | 1862 | 2 | easy | 2 |  |
| Chigho - Ghele | [21167689](https://www.openstreetmap.org/relation/21167689) | Tusheti | 4 | 550 | 2280 | 3 | easy | 3 |  |
| Uravi - Shkedi<br>ურავი - შკედი | [21176786](https://www.openstreetmap.org/relation/21176786) | Racha | 32.6 | 2234 | 3029 | 15.5 | ultra | 6 |  |
| Barisakho-Pkhituri trail<br>ბარისახო-ფხიტურის ბილიკი | [21180765](https://www.openstreetmap.org/relation/21180765) | Mtskheta-Mtianeti | 12.2 | 204 | 2756 | 5.5 | medium | 3 | region taken from the start (start Mtskheta-Mtianeti, middle Khevsureti); side spurs of the relation not included: 671 m |
| Bakurkhevi-Pkhituri-Chirdili trail<br>ბაკურხევი-ფხიტური-ჩირდილის ბილიკი | [21180778](https://www.openstreetmap.org/relation/21180778) | Mtskheta-Mtianeti | 16.3 | 826 | 2633 | 7.5 | medium | 6 | region taken from the start (start Mtskheta-Mtianeti, middle Khevsureti) |
| Khomi-Chargali trail<br>ხომი-ჩარგლის ბილიკი | [21212358](https://www.openstreetmap.org/relation/21212358) | Mtskheta-Mtianeti | 9.1 | 859 | 2007 | 4 | medium | 2 |  |
| Chargali-Kuchacha trail<br>ჩარგალი-კუჭეჭის ბილიკი | [21212678](https://www.openstreetmap.org/relation/21212678) | Mtskheta-Mtianeti | 22.5 | 1102 | 2088 | 9 | hard | 2 |  |
| Upper Omalo - Makratela Ridge - Beghela | [21232051](https://www.openstreetmap.org/relation/21232051) | Tusheti | 7.1 | 45 | 2885 | 3 | easy | 2 |  |
| Lenjeri - Mount Gul Trail<br>ლენჯერი - გულის მთა | [21431004](https://www.openstreetmap.org/relation/21431004) | Svaneti | 8.7 | 1467 | 2898 | 6 | medium | 3 | OSM marks it as a round trip; the line is one way (walk back the same way) |
| Shovi - Buba Glacier Trail<br>შოვი - ბუბა | [21580775](https://www.openstreetmap.org/relation/21580775) | Racha | 5.3 | 854 | 2505 | 3.5 | medium | 2 | passes within 3.2 km of the occupation line; OSM marks it as a round trip; the line is one way (walk back the same way) |
| Shovi - Udziro Lake - Glola Trail<br>შოვი - უძირო ტბა - გლოლა | [21581101](https://www.openstreetmap.org/relation/21581101) | Racha | 16.4 | 1641 | 3056 | 11 | ultra | 4 | passes within 1.2 km of the occupation line |
| Olaverdi-Lake Levani | [21668033](https://www.openstreetmap.org/relation/21668033) | Samtskhe-Javakheti | 20.8 | 67 | 2584 | 6 | medium | 2 |  |
| Mami - Latpari pass<br>მამი - ლატფარის უღელტეხილი | [21792147](https://www.openstreetmap.org/relation/21792147) | Svaneti | 12.7 | 1966 | 2842 | 8.5 | hard | 2 |  |

### Rejected candidates (89)

- no name — 45: [10491424](https://www.openstreetmap.org/relation/10491424), [10506152](https://www.openstreetmap.org/relation/10506152), [10506153](https://www.openstreetmap.org/relation/10506153), [10506156](https://www.openstreetmap.org/relation/10506156), [10506200](https://www.openstreetmap.org/relation/10506200), [10534821](https://www.openstreetmap.org/relation/10534821), [10534839](https://www.openstreetmap.org/relation/10534839), [10534840](https://www.openstreetmap.org/relation/10534840), [10543217](https://www.openstreetmap.org/relation/10543217), [10543219](https://www.openstreetmap.org/relation/10543219), [14074432](https://www.openstreetmap.org/relation/14074432), [14639544](https://www.openstreetmap.org/relation/14639544), [15055562](https://www.openstreetmap.org/relation/15055562), [15055563](https://www.openstreetmap.org/relation/15055563), [15055565](https://www.openstreetmap.org/relation/15055565), [15055566](https://www.openstreetmap.org/relation/15055566), [15055569](https://www.openstreetmap.org/relation/15055569), [15055570](https://www.openstreetmap.org/relation/15055570), [15055571](https://www.openstreetmap.org/relation/15055571), [15055572](https://www.openstreetmap.org/relation/15055572), [15055574](https://www.openstreetmap.org/relation/15055574), [15055575](https://www.openstreetmap.org/relation/15055575), [15055576](https://www.openstreetmap.org/relation/15055576), [15055577](https://www.openstreetmap.org/relation/15055577), [15055578](https://www.openstreetmap.org/relation/15055578), [15055580](https://www.openstreetmap.org/relation/15055580), [15055581](https://www.openstreetmap.org/relation/15055581), [15055582](https://www.openstreetmap.org/relation/15055582), [15068992](https://www.openstreetmap.org/relation/15068992), [15068993](https://www.openstreetmap.org/relation/15068993), [15068996](https://www.openstreetmap.org/relation/15068996), [15378088](https://www.openstreetmap.org/relation/15378088), [17255410](https://www.openstreetmap.org/relation/17255410), [18327170](https://www.openstreetmap.org/relation/18327170), [19935471](https://www.openstreetmap.org/relation/19935471), [20337320](https://www.openstreetmap.org/relation/20337320), [20948211](https://www.openstreetmap.org/relation/20948211), [20982867](https://www.openstreetmap.org/relation/20982867), [20982868](https://www.openstreetmap.org/relation/20982868), [20982869](https://www.openstreetmap.org/relation/20982869), [21148081](https://www.openstreetmap.org/relation/21148081), [21200311](https://www.openstreetmap.org/relation/21200311), [21200566](https://www.openstreetmap.org/relation/21200566), [21200599](https://www.openstreetmap.org/relation/21200599), [21843594](https://www.openstreetmap.org/relation/21843594)
- no Latin or Georgian name (Cyrillic only) — 7: [14378843](https://www.openstreetmap.org/relation/14378843) оз. Мзы, [14392808](https://www.openstreetmap.org/relation/14392808) Малая Рица, [14392811](https://www.openstreetmap.org/relation/14392811) оз.Рица-г. Пшегишхва, [14406325](https://www.openstreetmap.org/relation/14406325) Видовой Тепе-Баше, [14406357](https://www.openstreetmap.org/relation/14406357) в долину Семиозерья, [14406401](https://www.openstreetmap.org/relation/14406401) г. Мамдзышха, [14407325](https://www.openstreetmap.org/relation/14407325) к Водопаду
- no usable name ("…") — 6: [10534780](https://www.openstreetmap.org/relation/10534780) planned route (no trail yet), [21145878](https://www.openstreetmap.org/relation/21145878) for permit, [21147349](https://www.openstreetmap.org/relation/21147349) for permit, [21667996](https://www.openstreetmap.org/relation/21667996) Local, [21668013](https://www.openstreetmap.org/relation/21668013) Local Path Trial, [21668603](https://www.openstreetmap.org/relation/21668603) Local
- length N km is outside N–N km — 6: [21145877](https://www.openstreetmap.org/relation/21145877) to Akochistsikhe Castle (Castle of Love) (0.6 km), [21148571](https://www.openstreetmap.org/relation/21148571) Borbalo Trail (1.4 km), [21159972](https://www.openstreetmap.org/relation/21159972) Dochu–Goglurta (1.5 km), [21191499](https://www.openstreetmap.org/relation/21191499) Borbalo Trail (0.9 km), [21212464](https://www.openstreetmap.org/relation/21212464) Khomi-Chargali trail (1.1 km), [21241294](https://www.openstreetmap.org/relation/21241294) Kvemo Omalo - Visitors Center (1.0 km)
- members do not form one continuous line: N disconnected parts; nearest remaining gap over N km (> N m) — 4: [10495612](https://www.openstreetmap.org/relation/10495612) Kalotana Trail (no trail markers) (1 km), [21148566](https://www.openstreetmap.org/relation/21148566) Artani–Alavani Trail (1 km), [21148570](https://www.openstreetmap.org/relation/21148570) Chalakhevi–Dzvibakhevi Trail (1 km), [21191497](https://www.openstreetmap.org/relation/21191497) Alaznistavi–Borbalo–Ukanapshavi (1 km)
- members do not form one continuous line: N disconnected parts; nearest remaining gap N m (> N m) — 4: [10506157](https://www.openstreetmap.org/relation/10506157) Šuapcho (305 m), [10525944](https://www.openstreetmap.org/relation/10525944) Borbalo Trail (716 m), [10534750](https://www.openstreetmap.org/relation/10534750) Omalo–Diklo Fortress (326 m), [15413585](https://www.openstreetmap.org/relation/15413585) Alaznistavi–Borbalo–Ukanapshavi (716 m)
- members do not form one continuous line: a loop with N long branches — 3: [12354329](https://www.openstreetmap.org/relation/12354329) Mukhuri - Khaishi (), [21149704](https://www.openstreetmap.org/relation/21149704) Truso Valley (), [21212763](https://www.openstreetmap.org/relation/21212763) Magharoskari-Vashlobi trail ()
- members do not form one continuous line: branches: longest line covers only N% of the ways — 3: [21203581](https://www.openstreetmap.org/relation/21203581) Chichos Chala — Mountain Chicho — Lasharis Chala trail (76%), [21212774](https://www.openstreetmap.org/relation/21212774) Magharoskari-Vashlobi trail (84%), [21668133](https://www.openstreetmap.org/relation/21668133) Paravani-Lake Levani (81%)
- a shorter piece of "…" whose ends have no place names to tell it apart — 3: [21148568](https://www.openstreetmap.org/relation/21148568) Artani–Alavani Trail, [21191498](https://www.openstreetmap.org/relation/21191498) Chalakhevi–Dzvibakhevi Trail, [21212463](https://www.openstreetmap.org/relation/21212463) Khomi-Chargali trail
- members do not form one continuous line: the ways form several loops or parallel alternatives — 2: [15663075](https://www.openstreetmap.org/relation/15663075) Chakvistavi, [21212913](https://www.openstreetmap.org/relation/21212913) Ortskali-Barisakho trail
- duplicate or variant of a catalogue trail: N% of it runs along "…" — 2: [13703283](https://www.openstreetmap.org/relation/13703283) TCT Becho to Mestia (97%), [18231305](https://www.openstreetmap.org/relation/18231305) აჯამეთის ბილიკის მარშრუტი (100%)
- comes within N m of the occupation line — 1: [15413515](https://www.openstreetmap.org/relation/15413515) Kalitsadi Lake Trail
- rejected by hand: the OSM mapper notes (fixme) that the route was copied from a map sign and has not been checked on the ground — 1: [19470233](https://www.openstreetmap.org/relation/19470233) KBK ქვედა ყარი - ლურჯი ტბა- ხარხას ტბა
- rejected by hand: the relation lists its ways twice: the stitched line is N km out and back while its own distance tag says N km — 1: [20296500](https://www.openstreetmap.org/relation/20296500) Kaklebi - Bagebi
- crosses the national border — 1: [21160554](https://www.openstreetmap.org/relation/21160554) Stepantsminda–Kazbegi (no trailmarks)

## Photos

Geotagged Wikimedia Commons files were searched in a 1.5 km corridor along each route, widened to 10 km when that found fewer than four usable files. Accepted: JPEG, ≥ 1600 px wide, landscape 1.2–2.2, Public Domain / CC0 / CC BY / CC BY-SA with a named author; maps, interiors, people, plants, animals, night shots and similar were filtered by title and category, and every chosen photo was checked by eye on contact sheets (rejections are recorded in `scripts/content/data/photo-review.json`). One cover + up to three gallery photos per trail, at least 300 m apart. Match: on-trail ≤ 1.5 km from the route, nearby ≤ 5 km, area ≤ 10 km.

- Visual review: 323 automatically chosen files were rejected after looking at them (event photo with wrong coordinates 68, taken from orbit at night 32, satellite view 25, taken from the space station 13, construction site 13, date stamp 12, taken from orbit 11, close-up of animals 8, buildings and close-ups 7, close-up of an animal 6, close-up of a building 6, close-up of an insect 5, town building 4, church interior (fresco) 3, framed image with a border 3, close-up of a car 3, building under scaffolding 3, close-up of a facade 3, street with a building 3, town attraction 3, taken from an aircraft 2, annotated image (text over the peaks) 2, night shot 2, school building 2, close-up of an object 2, street scene, date stamp 2, road sign 2, tank monument 2, close-up with a person 2, street with a house 2, close-up of a stone carving 2, close-up of a window 2, road 2, apartment blocks 2, town bridge 2, close-up of a plant 1, abstract close-up, not a view of the place 1, modern building and car park 1, a sign 1, portrait of a person 1, church interior (frescoes) 1, close-up of the ground 1, town park, date stamp 1, blurred aerial view 1, over-processed colours 1, close-up of a wall 1, amusement ride 1, people at a building and car park 1, blurred 1, road signs 1, street with cars 1, portrait of a person indoors 1, stadium 1, close-up of a vehicle 1, dark, mostly a pylon 1, close-up of a flower 1, close-up of flowers 1, people and a minibus 1, road construction 1, group portrait 1, town square 1, over-processed town street 1, indoor scene with people 1, unclear subject in fog 1, asphalt road with signs 1, town park 1, close-up of leaves 1, close-up of tree bark 1, building with scaffolding 1, bulldozers 1, indoor group photo 1, backlit town scene 1, dark view through a doorway 1, bus stop and road 1, not a view of the wetland 1, dark interior 1, vehicle on a road in fog 1, stage performance indoors 1, office interior with people 1, road with a car 1, asphalt road 1, finger over the lens 1, statue in a town square 1, signpost 1, close-up of an inscription 1, town view 1, a house 1, derelict building with graffiti 1, town street 1, kiosk and road signs in front 1, dark, unclear subject 1, animal close-ups 1, derelict buildings 1, derelict building seen from a car 1, close-up of a sculpture 1, close-up of a doorway 1, derelict building 1), and 18 covers were picked by hand. Most rejections were photos taken from the International Space Station or from aircraft, which Commons geotags with the ground point below them; such files are now also filtered automatically.
- 010 Okatse Canyon Trail: deliberately left without photos — the stored route is about 13 km from Okatse Canyon, so photos near it would show somewhere else.
- 4b3f1849 Upper Krikhi: deliberately left without photos — only street and road photos were found near the route.
- aae55625 Abastumani-Jaji lake: deliberately left without photos — the photos near the route are observatory buildings, close-ups or carry date stamps.
- Trails with no suitable photo within 10 km (15; the app shows its placeholder): 010 Okatse Canyon Trail, 024 Khaishi to Lakumura Lake, 026 Lake Memuli, 046 St. Andrews Trail, 144 Tsaleri - mount Kva - Place Zagari, 4b3f1849 Upper Krikhi, be63d9d7 Khadori - Makhvali Waterfall, 817a5588 Adjameti trail route, 5e513c72 Adjameti Circular, aae55625 Abastumani-Jaji lake, c654f748 Jaji lake-Ukhuti, e59bd7ab Vartsikhe Ajameti Park, 1d0421c9 Kaduina Pass Trail, 6b76377c Chalakhevi - Dzvibakhevi Trail, fad1fc55 Uravi - Shkedi.
- Owner uploads are kept: 1 cover(s) on the project's storage stay as they are (100) and no photo of ours replaces them; the 10 `trail_media` rows on the project's storage are never touched — the apply tool only deletes rows whose URL contains `images.unsplash.com` (and rows it created itself).
- Every published photo, the cover included, gets a `trail_media` row whose caption is its credit; the cover row has sort_order 0 and exactly the URL written to `cover_image_url` (a `?v=<hash>` suffix changes when the file does), gallery rows follow with 1–3. `mobile/assets/data/photo-credits.json` lists the same photos with `file` = the stored file name (`cover.webp`, `photo-1.webp`, …).
- Size targets (cover ≤ 120 KB at 960 px, gallery ≤ 220 KB at 1280 px): 123 very detailed photos stay above them at WebP quality 40 (lower quality turns foliage into blotches): 001/photo-1.webp 307 KB, 002/photo-1.webp 253 KB, 002/photo-2.webp 255 KB, 003/photo-1.webp 250 KB, 004/photo-2.webp 379 KB, 004/photo-3.webp 259 KB, 006/cover.webp 130 KB, 006/photo-2.webp 241 KB, 007/photo-1.webp 331 KB, 007/photo-2.webp 286 KB, 009/photo-1.webp 289 KB, 012/photo-2.webp 237 KB, 014/photo-1.webp 223 KB, 015/cover.webp 129 KB, 015/photo-1.webp 256 KB, 021/photo-2.webp 234 KB, 021/photo-3.webp 273 KB, 022/photo-1.webp 268 KB, 022/photo-3.webp 230 KB, 023/cover.webp 128 KB, 025/cover.webp 139 KB, 027/photo-1.webp 255 KB, 028/photo-1.webp 233 KB, 029/photo-1.webp 287 KB, 029/photo-2.webp 320 KB, 029/photo-3.webp 297 KB, 031/photo-2.webp 230 KB, 033/cover.webp 126 KB, 035/photo-1.webp 337 KB, 036/photo-2.webp 221 KB, 037/photo-3.webp 266 KB, 038/photo-1.webp 239 KB, 038/photo-3.webp 379 KB, 039/photo-2.webp 269 KB, 040/photo-3.webp 259 KB, 043/photo-1.webp 274 KB, 043/photo-3.webp 256 KB, 049/cover.webp 143 KB, 049/photo-2.webp 224 KB, 049/photo-3.webp 316 KB, 050/cover.webp 180 KB, 050/photo-3.webp 304 KB, 051/cover.webp 153 KB, 052/photo-2.webp 273 KB, 055/cover.webp 137 KB, 101/cover.webp 153 KB, 101/photo-1.webp 284 KB, 101/photo-2.webp 227 KB, 101/photo-3.webp 326 KB, 102/photo-3.webp 254 KB, 104/cover.webp 134 KB, 104/photo-1.webp 240 KB, 104/photo-2.webp 248 KB, 105/cover.webp 143 KB, 105/photo-1.webp 256 KB, 109/cover.webp 122 KB, 111/photo-1.webp 222 KB, 111/photo-2.webp 271 KB, 111/photo-3.webp 303 KB, 112/photo-1.webp 353 KB, 115/cover.webp 188 KB, 115/photo-1.webp 309 KB, 116/photo-2.webp 250 KB, 122/cover.webp 149 KB, 126/photo-2.webp 241 KB, 126/photo-3.webp 252 KB, 127/photo-1.webp 259 KB, 128/cover.webp 136 KB, 128/photo-1.webp 319 KB, 130/photo-1.webp 244 KB, 130/photo-2.webp 256 KB, 130/photo-3.webp 232 KB, 131/photo-1.webp 245 KB, 132/photo-3.webp 270 KB, 133/cover.webp 133 KB, 135/photo-2.webp 260 KB, 137/photo-1.webp 300 KB, 137/photo-3.webp 266 KB, 138/cover.webp 124 KB, 138/photo-1.webp 296 KB, 139/cover.webp 145 KB, 139/photo-1.webp 339 KB, 139/photo-3.webp 261 KB, 141/photo-1.webp 284 KB, 146/photo-2.webp 255 KB, da5772d0/photo-3.webp 318 KB, 180b5176/photo-3.webp 280 KB, ed74c07d/photo-2.webp 250 KB, ed74c07d/photo-3.webp 276 KB, 742da893/cover.webp 166 KB, 50a86d53/photo-3.webp 265 KB, 92e58af5/photo-1.webp 221 KB, 92e58af5/photo-2.webp 259 KB, 5ad3b166/photo-1.webp 294 KB, 1b2d0b6b/photo-3.webp 239 KB, 9aaa45ae/cover.webp 176 KB, 9aaa45ae/photo-3.webp 237 KB, fe2d5230/cover.webp 133 KB, bff2cada/cover.webp 164 KB, bff2cada/photo-3.webp 314 KB, 2d75b043/cover.webp 159 KB, 2d75b043/photo-1.webp 280 KB, 6a4b5e1e/cover.webp 168 KB, 6a4b5e1e/photo-1.webp 235 KB, eb483c24/cover.webp 168 KB, 5ec7081a/cover.webp 186 KB, 5ec7081a/photo-2.webp 242 KB, ee4049b6/cover.webp 187 KB, ee4049b6/photo-2.webp 293 KB, ee4049b6/photo-3.webp 346 KB, 5829cb59/cover.webp 152 KB, 5829cb59/photo-1.webp 271 KB, a04bdebb/cover.webp 141 KB, a04bdebb/photo-1.webp 304 KB, 8d176dea/cover.webp 145 KB, a6401af7/photo-1.webp 263 KB, 46d45c80/cover.webp 139 KB, 69a5c611/cover.webp 125 KB, a4346890/cover.webp 175 KB, a4346890/photo-2.webp 253 KB, 0c44a860/photo-2.webp 259 KB, 7bf737db/photo-1.webp 266 KB, 7bf737db/photo-2.webp 281 KB.

## Georgian text written by this pipeline — please review

Toponyms come from OSM `name:ka`; joined names and the description template were assembled by the pipeline and need a native speaker's check.

- Description template used for 130 trails: "მარშრუტის სიგრძეა {km} კმ. ჯამური აღმართი — დაახლოებით {ascent} მ, დაღმართი — დაახლოებით {descent} მ, უმაღლესი წერტილი — დაახლოებით {max} მ ზღვის დონიდან."
- 044 name_ka: **უთხოვარი და ტბიყელის ტბა** — written by hand
- 100 name_ka: **ადიში - იფრალი** — joined from OSM name:ka of Adishi = ადიში (node/478551574); Iprali = იფრალი (node/478551568)
- 102 name_ka: **ბაკი - დოლასვიფი** — joined from OSM name:ka of Bak Pass = ბაკი (node/8979879961); Dolasvipi = დოლასვიფი (node/478560260)
- 103 name_ka: **ბაკი - მაზერი** — joined from OSM name:ka of Bak Pass = ბაკი (node/8979879961); Mazeri = მაზერი (node/478560253)
- 106 name_ka: **დართლო - კვავლო** — joined from OSM name:ka of Dartlo = დართლო (node/449209837); Kvavlo = კვავლო (node/941363444)
- 107 name_ka: **დოლასვიფი - ლატალი** — joined from OSM name:ka of Dolasvipi = დოლასვიფი (node/478560260); Latali = ლატალი (node/4621952219)
- 108 name_ka: **ჰებუდი - დოლასვიფი** — joined from OSM name:ka of Ebudi = ჰებუდი (node/478566946); Dolasvipi = დოლასვიფი (node/478560260)
- 111 name_ka: **იფრალი - უშგული** — joined from OSM name:ka of Iprari = იფრალი (node/478551568); Ushguli = უშგული (node/1855444526)
- 130 name_ka: **როშკა - ჯუთა** — joined from OSM name:ka of Roshka = როშკა (node/449219302); Juta = ჯუთა (node/448929968)
- 143 name_ka: **ცალერი - კიჩხულდაში** — joined from OSM name:ka of Tsaleri = ცალერი (node/478655775); Kichkhuldashi = კიჩხულდაში (node/478655774)
- 148 name_ka: **უშხვანარი - ლატალი** — joined from OSM name:ka of Ushkhvanari = უშხვანარი (node/478560257); Latali = ლატალი (node/4621952219)
- 9a5c4bc5 name_ka: **გუდანი - უკანხადუ** — joined from OSM name:ka of Gudani = გუდანი (node/449219292); Ukankhadu = უკანხადუ (node/449219286)
- 00c2be84 name_ka: **შატილი - კისტანი** — joined from OSM name:ka of Shatili = შატილი (node/430738640); Kistani = კისტანი (node/449219234)
- 4f46aba7 name_ka: **ატაბე - კისტანი** — joined from OSM name:ka of Atabe = ატაბე (node/449219288); Kistani = კისტანი (node/449219234)
- 742da893 name_ka: **მუცო - ანდაქი** — joined from OSM name:ka of Mutso = მუცო (node/430738641); Andaki = ანდაქი (node/449219235)
- 5ad3b166 name_ka: **დოჭუ - გოგლურთა** — joined from OSM name:ka of Dochu = დოჭუ (node/449209835); Gogrulta = გოგლურთა (node/5458373900)
- baf27867 name_ka: **არმაზი - არმაზის ციხე** — joined from OSM name:ka of Armazi = არმაზი (node/508590077); Armazi Fortress = არმაზის ციხე (way/1003499187)
- 1b2d0b6b name_ka: **ზესხო - ღები** — joined from OSM name:ka of Zeskho = ზესხო (node/478550664); Ghebi = ღები (node/429184934)
- a6401af7 name_ka: **გოგლურთა - ილიურთა** — joined from OSM name:ka of Gogrulta = გოგლურთა (node/5458373900); Iliurta = ილიურთა (node/5458373901)
- 40e7a96c name_ka: **ბეღელა - ილიურთა** — joined from OSM name:ka of Beghela = ბეღელა (node/5814091223); Iliurta = ილიურთა (node/5458373901)
- 0fdc85fd name_ka: **შენაქო - აგეურთა - ტატიკბოსელთანა** — joined from OSM name:ka of Shenako = შენაქო (node/449209831); Ageurta = აგეურთა (node/7908674774); Tatikboselthana = ტატიკბოსელთანა (node/11079784525)
- 2aae266c name_ka: **ვერხოვანი - ინდურთა** — joined from OSM name:ka of Verkhovani = ვერხოვანი (node/5458373898); Indurta = ინდურთა (node/5458373897)

## Not done / limits

- Routes flagged for manual review keep their broken geometry and unverified figures; see above.
- SRTM-based ascent is an estimate (see method). Checkpoint elevations are DEM values, not surveyed.
- Descriptions of hand-curated trails were not rewritten (except where they placed the trail in the wrong region); their claims about scenery or facilities were not verified.
- Photos were judged on downscaled contact sheets; a watermark or a subtle problem may have slipped through.
