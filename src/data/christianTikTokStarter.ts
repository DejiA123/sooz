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

/** Bump when links are added so curators' apps load the new ones automatically. */
export const STARTER_VERSION = "2";

/**
 * TikTok accounts that post Christian content. Shown in "Christian creators" (their live TikTok
 * profile, so every new video appears automatically) and added as trusted creators, so videos of
 * theirs that anyone suggests are approved straight away.
 */
export interface ChristianCreator {
  handle: string;
  name: string;
  kind: "Worship" | "Gospel" | "Preaching" | "Scripture";
}

export const CHRISTIAN_CREATORS: ChristianCreator[] = [
  { handle: "bethelmusic", name: "Bethel Music", kind: "Worship" },
  { handle: "hillsongworship", name: "Hillsong Worship", kind: "Worship" },
  { handle: "elevation.worship", name: "Elevation Worship", kind: "Worship" },
  { handle: "maverickcitymusic", name: "Maverick City Music", kind: "Worship" },
  { handle: "hiforrestt", name: "Forrest Frank", kind: "Worship" },
  { handle: "cecewinansofficial", name: "CeCe Winans", kind: "Gospel" },
  { handle: "mosesblisslive", name: "Moses Bliss", kind: "Gospel" },
  { handle: "mercychinwo", name: "Mercy Chinwo", kind: "Gospel" },
  { handle: "famouzgospel", name: "Famouz Gospel", kind: "Gospel" },
  { handle: "gospelhotspot", name: "Gospel Hotspot", kind: "Gospel" },
  { handle: "pastorjerryeze", name: "Pastor Jerry Eze", kind: "Preaching" },
  { handle: "iammiketodd", name: "Pastor Mike Todd", kind: "Preaching" },
  { handle: "tbn_official", name: "TBN", kind: "Preaching" },
  { handle: "youversion", name: "YouVersion Bible App", kind: "Scripture" },
  { handle: "bibleproject", name: "BibleProject", kind: "Scripture" },
];

export const STARTER_TRUSTED_CREATORS = CHRISTIAN_CREATORS.map((c) => c.handle);

export const STARTER_TIKTOKS: StarterTikTok[] = [
  // Worship — official artist accounts
  { url: "https://www.tiktok.com/@bethelmusic/video/7389766812881292590", official: true }, // Holy Forever
  { url: "https://www.tiktok.com/@bethelmusic/video/7390814507615931694", official: true },
  { url: "https://www.tiktok.com/@maverickcitymusic/video/7608327019335568671", official: true }, // Million Little Miracles
  { url: "https://www.tiktok.com/@hiforrestt/video/7222086499435662638", official: true }, // Forrest Frank
  { url: "https://www.tiktok.com/@hiforrestt/video/7189004961072860462", official: true },
  { url: "https://www.tiktok.com/@elevation.worship/video/7590069163171876110", official: true }, // "Alleluia"
  { url: "https://www.tiktok.com/@hillsongworship/video/7343400152830332193", official: true }, // Here I Am To Worship
  { url: "https://www.tiktok.com/@hillsongworship/video/7350432143564131617", official: true }, // Easter — Calvary covers it all
  { url: "https://www.tiktok.com/@tbn_official/video/7510264011041131818", official: true }, // CeCe Winans — That's My King
  // African gospel — official artist accounts
  { url: "https://www.tiktok.com/@mosesblisslive/video/7267845164016700678", official: true }, // Mercy
  { url: "https://www.tiktok.com/@mosesblisslive/video/7492805699450195206", official: true }, // Baba Oh
  { url: "https://www.tiktok.com/@mosesblisslive/video/7389301582975814917", official: true },
  { url: "https://www.tiktok.com/@mosesblisslive/video/7433456422676892933", official: true },
  { url: "https://www.tiktok.com/@mosesblisslive/video/7478408657869212936", official: true }, // Product of mercy
  { url: "https://www.tiktok.com/@mosesblisslive/video/7436107662552468791", official: true }, // John 3:27
  { url: "https://www.tiktok.com/@mercychinwo/video/7294562792445578502", official: true },
  { url: "https://www.tiktok.com/@mercychinwo/video/7450487916566023430", official: true },
  // Preaching — Pastor Jerry Eze (NSPPD)
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7498319732941262135", official: true },
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7467560518815976710", official: true },
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7487016320215665975", official: true },
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7481910516957465861", official: true },
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7487649644973952261", official: true },
  // Pastor Mike Todd (Transformation Church)
  { url: "https://www.tiktok.com/@iammiketodd/video/7358972677383818542", official: true }, // Worship in Africa
  { url: "https://www.tiktok.com/@iammiketodd/video/7146947611822525739", official: true },
  { url: "https://www.tiktok.com/@4intheam/video/7176640425548107051" }, // Mike Todd sermon clip
  // Scripture — YouVersion Bible App and BibleProject
  { url: "https://www.tiktok.com/@youversion/video/7492423888324873518", official: true }, // Galatians 5:13
  { url: "https://www.tiktok.com/@youversion/video/7490998287529643310", official: true },
  { url: "https://www.tiktok.com/@bibleproject/video/6888744673180011781", official: true }, // Choosing a Bible translation
  // Gospel worship clips (African gospel and more)
  { url: "https://www.tiktok.com/@famouzgospel/video/7253369391885077765" }, // Tobechukwu — Nathaniel Bassey × Mercy Chinwo
  { url: "https://www.tiktok.com/@famouzgospel/video/7203071185662315782" },
  { url: "https://www.tiktok.com/@gospelhotspot/video/7224357149919595782" }, // Tobechukwu (Praise God)
  { url: "https://www.tiktok.com/@believespecial/video/7430779352448716038" }, // Father of Spirits — Theophilus Sunday
  { url: "https://www.tiktok.com/@nathanielblow1/video/7225648064319507717" }, // Holy Spirit carry me go — Nathaniel Bassey
  { url: "https://www.tiktok.com/@agapelegacy/video/7503223503613676855" }, // Nathaniel Bassey worship
  { url: "https://www.tiktok.com/@gmfg_tv_official/video/7365413526896233736" }, // Amazing God — Mercy Chinwo
  { url: "https://www.tiktok.com/@lidu.c/video/7251988774714985733" }, // Until Grace — CeCe Winans & Tauren Wells
  { url: "https://www.tiktok.com/@dripires15/video/7073284394898885934" }, // Come Again — Elevation × Maverick City
  { url: "https://www.tiktok.com/@pawalajanyan/video/7245236206068387078" }, // Wait On You
  { url: "https://www.tiktok.com/@khayamthethwa0/video/7306163880013696262" }, // Verse of the Day
  { url: "https://www.tiktok.com/@vickmodidit/video/7319557774675905797" }, // El Roi declarations
  { url: "https://www.tiktok.com/@kerigan.denae/video/7210527390395780398" }, // Tips for new Christians
];
