/**
 * Starter pack: real Christian TikTok videos so the For You feed has faith content from day one.
 * Each link still goes through the `tiktok-import` edge function, which confirms it with TikTok
 * (removed or private videos are skipped) and runs the faith filter.
 *
 * `official` = posted by the ministry/artist's own account; those are also added as trusted creators,
 * so future links from them are approved automatically.
 */
export interface StarterTikTok {
  url: string;
  official?: boolean;
}

export const STARTER_TRUSTED_CREATORS = [
  "bethelmusic",
  "maverickcitymusic",
  "elevation.worship",
  "hiforrestt",
  "pastorjerryeze",
  "youversion",
  "bibleproject",
];

export const STARTER_TIKTOKS: StarterTikTok[] = [
  // Worship — official artist accounts
  { url: "https://www.tiktok.com/@bethelmusic/video/7389766812881292590", official: true }, // Holy Forever
  { url: "https://www.tiktok.com/@bethelmusic/video/7390814507615931694", official: true },
  { url: "https://www.tiktok.com/@maverickcitymusic/video/7608327019335568671", official: true }, // Million Little Miracles
  { url: "https://www.tiktok.com/@hiforrestt/video/7222086499435662638", official: true }, // Forrest Frank
  { url: "https://www.tiktok.com/@hiforrestt/video/7189004961072860462", official: true },
  // Preaching — Pastor Jerry Eze (NSPPD)
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7498319732941262135", official: true },
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7467560518815976710", official: true },
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7487016320215665975", official: true },
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7481910516957465861", official: true },
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7487649644973952261", official: true },
  // Scripture — YouVersion Bible App and BibleProject
  { url: "https://www.tiktok.com/@youversion/video/7492423888324873518", official: true }, // Galatians 5:13
  { url: "https://www.tiktok.com/@youversion/video/7490998287529643310", official: true },
  { url: "https://www.tiktok.com/@bibleproject/video/6888744673180011781", official: true }, // Choosing a Bible translation
  // Gospel worship clips (African gospel and more)
  { url: "https://www.tiktok.com/@famouzgospel/video/7253369391885077765" }, // Tobechukwu — Nathaniel Bassey × Mercy Chinwo
  { url: "https://www.tiktok.com/@famouzgospel/video/7203071185662315782" },
  { url: "https://www.tiktok.com/@gospelhotspot/video/7224357149919595782" }, // Tobechukwu (Praise God)
  { url: "https://www.tiktok.com/@believespecial/video/7430779352448716038" }, // Father of Spirits — Theophilus Sunday
  { url: "https://www.tiktok.com/@dripires15/video/7073284394898885934" }, // Come Again — Elevation × Maverick City
  { url: "https://www.tiktok.com/@pawalajanyan/video/7245236206068387078" }, // Wait On You
  { url: "https://www.tiktok.com/@khayamthethwa0/video/7306163880013696262" }, // Verse of the Day
  { url: "https://www.tiktok.com/@vickmodidit/video/7319557774675905797" }, // El Roi declarations
  { url: "https://www.tiktok.com/@kerigan.denae/video/7210527390395780398" }, // Tips for new Christians
];
