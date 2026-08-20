export const SITE = {
  name: "MA Removals",
  tagline: "Trusted Home Removals Across Scotland",
  domain: "www.maremovals.com",
  url: process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.maremovals.com",
  phone: "+447426467112",
  phoneDisplay: "07426 467 112",
  whatsapp: "+447426467112",
  email: "info@maremovals.co.uk",
  address: "Glasgow, Scotland, UK",
  hours: "Mon–Sun, 6:00–22:00",
  insurance: "Goods in Transit Insurance",
  social: {
    instagram: "https://www.instagram.com/maremovals",
    tiktok: "https://www.tiktok.com/@ma.removals",
    facebook: "https://www.facebook.com/share/1cYitut63L/",
  },
  // Google Business Profile (Maps) — used for local SEO structured data & embed.
  // NOTE: we intentionally do NOT surface the .co.uk domain/phone listed on the
  // Google profile; the production domain is www.maremovals.com.
  maps: {
    profileUrl: "https://maps.app.goo.gl/7tzUCVFDWQZLxSHA8",
    cid: "18249295036985083646",
    placeId: "0xa7edb8bc1cb9f479:0xfd428525b0cb86fe",
    embedUrl: "https://maps.google.com/maps?cid=18249295036985083646&output=embed",
    directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=55.8282702%2C-4.2798123",
    rating: 4.5,
    reviewCount: 16,
    latitude: 55.8282702,
    longitude: -4.2798123,
  },
} as const;

export const SERVICES = [
  { slug: "house-move", name: "House Move", icon: "🏠", basePrice: 264 },
  { slug: "van-with-man", name: "Van with Man", icon: "🚐", basePrice: 45 },
  { slug: "furniture-removals", name: "Furniture Removals", icon: "🛋️", basePrice: 45 },
  { slug: "deliveries", name: "Deliveries", icon: "📬", basePrice: 45 },
  { slug: "business-removals", name: "Business Removals", icon: "🏢", basePrice: 180 },
  { slug: "hotel-removals", name: "Hotel Removals", icon: "🏨", basePrice: 210 },
  { slug: "office-removals", name: "Office Removals", icon: "🖥️", basePrice: 168 },
  { slug: "piano-moves", name: "Piano Moves", icon: "🎹", basePrice: 108 },
  { slug: "packing-service", name: "Packing Service", icon: "📋", basePrice: 48 },
] as const;

export type ServiceSlug = (typeof SERVICES)[number]["slug"];

export const AREAS = {
  glasgow: [
    "Glasgow", "Paisley", "East Kilbride", "Hamilton", "Motherwell",
    "Coatbridge", "Airdrie", "Wishaw", "Bellshill", "Cumbernauld",
    "Clydebank", "Rutherglen", "Cambuslang", "Kirkintilloch", "Bishopbriggs",
    "Bearsden", "Milngavie", "Barrhead", "Newton Mearns", "Giffnock",
    "Renfrew", "Johnstone", "Erskine", "Dumbarton", "Helensburgh",
    "Greenock", "Port Glasgow", "Gourock", "Largs", "Lanark",
    "Kilmarnock", "Irvine", "Ayr", "Prestwick", "Troon", "Kilwinning", "Saltcoats",
  ],
  edinburgh: [
    "Edinburgh", "Leith", "Musselburgh", "Dalkeith", "Livingston",
    "Bathgate", "Linlithgow", "Broxburn", "South Queensferry", "Penicuik",
    "Bonnyrigg", "Loanhead", "Tranent", "Haddington", "North Berwick", "Dunbar",
    "Dunfermline", "Kirkcaldy", "Glenrothes", "Cupar", "St Andrews",
    "Leven", "Burntisland", "Inverkeithing", "Anstruther",
  ],
  stirling: [
    "Stirling", "Falkirk", "Grangemouth", "Alloa", "Dunblane",
    "Bridge of Allan", "Callander", "Denny", "Larbert", "Bo'ness", "Tillicoultry",
  ],
  dundee: [
    "Dundee", "Broughty Ferry", "Monifieth", "Carnoustie", "Arbroath",
    "Montrose", "Forfar", "Brechin", "Kirriemuir", "Perth",
    "Blairgowrie", "Coupar Angus", "Crieff", "Pitlochry", "Aberfeldy",
  ],
  aberdeen: [
    "Aberdeen", "Bridge of Don", "Dyce", "Westhill", "Inverurie",
    "Stonehaven", "Peterhead", "Fraserburgh", "Ellon", "Banchory",
    "Elgin", "Forres", "Buckie", "Keith", "Huntly",
  ],
  highlands: [
    "Inverness", "Nairn", "Aviemore", "Grantown-on-Spey", "Fort William",
    "Oban", "Dingwall", "Ullapool", "Thurso", "Wick",
    "Portree", "Stornoway", "Kirkwall", "Lerwick",
  ],
  borders: [
    "Galashiels", "Hawick", "Melrose", "Peebles", "Selkirk",
    "Jedburgh", "Kelso", "Dumfries", "Annan", "Lockerbie",
    "Stranraer", "Castle Douglas", "Newton Stewart", "Moffat",
  ],
} as const;

export type Region = keyof typeof AREAS;
export type AreaName = (typeof AREAS)[Region][number];

export function slugifyArea(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export const ALL_AREAS: { name: string; slug: string; region: Region }[] =
  (Object.entries(AREAS) as [Region, readonly string[]][]).flatMap(
    ([region, names]) =>
      names.map((name) => ({ name, slug: slugifyArea(name), region }))
  );

export const FAQS = [
  {
    q: "How much does a removal cost in Scotland?",
    a: "Prices start from £45 for small moves and from about £264 for home moves. When a matching AnyVan benchmark is available, our instant quote is capped at 10% below it; otherwise the price is calculated from your items, access and mileage. Use our online calculator for an instant fixed quote — no hidden fees.",
  },
  {
    q: "Are you fully insured?",
    a: "Yes. Every job is covered by Goods in Transit Insurance, so your belongings are protected from the moment we load to the moment we unload.",
  },
  {
    q: "Which areas do you cover?",
    a: "We cover the whole of Scotland — Glasgow, Edinburgh, Dundee, Aberdeen, Stirling, Inverness, the Highlands & Islands and the Borders, plus every town and village in between. Wherever you're moving in Scotland, we can help.",
  },
  {
    q: "Can you move on weekends or at short notice?",
    a: "Absolutely. We operate 7 days a week, 6am–10pm, and same-day / next-day slots are often available. Call or WhatsApp us and we'll do our best to fit you in.",
  },
  {
    q: "Do you move pianos and bulky items?",
    a: "Yes — pianos, wardrobes, sofas, appliances and other awkward items are no problem. Our team has the equipment and experience to move them safely.",
  },
  {
    q: "How do I pay?",
    a: "You can pay securely online when you book, or on the day of your move. We accept card and bank transfer. You'll always get a fixed price upfront.",
  },
] as const;
