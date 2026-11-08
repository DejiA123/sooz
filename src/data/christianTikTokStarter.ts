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
  /** Short caption shown on the slide (TikTok's own caption also appears inside its player). */
  caption: string;
  official?: boolean;
  /** Video width × height, only for the few that aren't the usual 9:16 (TikTok's lookup no longer says). */
  size?: [number, number];
}

/** Bump when links are added so curators' apps load the new ones automatically. */
export const STARTER_VERSION = "3";

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
  { url: "https://www.tiktok.com/@bethelmusic/video/7389766812881292590", official: true, caption: "Holy Forever 🙌 #worship #bethelmusic" },
  { url: "https://www.tiktok.com/@bethelmusic/video/7390814507615931694", official: true, caption: "Worship with Bethel Music #worship" },
  { url: "https://www.tiktok.com/@maverickcitymusic/video/7608327019335568671", official: true, caption: "Miracles on miracles 🙌 Million Little Miracles #worship" },
  { url: "https://www.tiktok.com/@hiforrestt/video/7222086499435662638", official: true, caption: "LIFT MY HANDS — Forrest Frank #christianmusic" },
  { url: "https://www.tiktok.com/@hiforrestt/video/7189004961072860462", official: true, caption: "What do y'all think of this song? ✝️ #christian #christianmusic" },
  { url: "https://www.tiktok.com/@elevation.worship/video/7590069163171876110", official: true, caption: "I CAME TO PRAISE 🙌 “Alleluia” #worship" },
  { url: "https://www.tiktok.com/@hillsongworship/video/7343400152830332193", official: true, caption: "Here I am to say that You're my God 🙏 #worship" },
  { url: "https://www.tiktok.com/@hillsongworship/video/7350432143564131617", official: true, caption: "All praise to the One who has ransomed my soul — Calvary covers it all 💙 #easter #worship" },
  { url: "https://www.tiktok.com/@tbn_official/video/7510264011041131818", official: true, caption: "“That's My King!” 🙌 CeCe Winans at the K-LOVE Fan Awards #worship" },
  // African gospel — official artist accounts
  { url: "https://www.tiktok.com/@mosesblisslive/video/7267845164016700678", official: true, caption: "Mercy 😭 Thank you Lord 🙏🏽 Our new song “MERCY” #gospel" },
  { url: "https://www.tiktok.com/@mosesblisslive/video/7492805699450195206", official: true, caption: "Baba Oh — I thank God for inspiring me with amazing songs #worship" },
  { url: "https://www.tiktok.com/@mosesblisslive/video/7389301582975814917", official: true, caption: "Trending gospel from Moses Bliss #gospel #worship" },
  { url: "https://www.tiktok.com/@mosesblisslive/video/7433456422676892933", official: true, caption: "Moses Bliss songs compilation #gospel #worship" },
  { url: "https://www.tiktok.com/@mosesblisslive/video/7478408657869212936", official: true, caption: "I'm a product of Your mercy 😭 If you're a product of mercy and the help of God, share this sound #gospel" },
  { url: "https://www.tiktok.com/@mosesblisslive/video/7436107662552468791", official: true, caption: "A man can receive nothing, except it be given him from heaven. John 3:27 KJV" },
  { url: "https://www.tiktok.com/@mercychinwo/video/7294562792445578502", official: true, caption: "Grateful worship 🙏 #mercychinwo #worship", size: [480, 600] },
  { url: "https://www.tiktok.com/@mercychinwo/video/7450487916566023430", official: true, caption: "The path of the just only shines brighter 💡 #gospel" },
  // Preaching — Pastor Jerry Eze (NSPPD)
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7498319732941262135", official: true, caption: "Pack your load!!! #handofGod #sermon" },
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7467560518815976710", official: true, caption: "Go for destiny relationships!!! #sermon" },
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7487016320215665975", official: true, caption: "Embrace your emotional sensitivity #sermon" },
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7481910516957465861", official: true, caption: "Celebration and testimonies 🙌 #NSPPD #testimony", size: [854, 480] },
  { url: "https://www.tiktok.com/@pastorjerryeze/video/7487649644973952261", official: true, caption: "In this new season, the absence of men will not mean the absence of God #sermon" },
  // Pastor Mike Todd (Transformation Church)
  { url: "https://www.tiktok.com/@iammiketodd/video/7358972677383818542", official: true, caption: "The sound of heaven touching earth in Africa #worship #transformationworship" },
  { url: "https://www.tiktok.com/@iammiketodd/video/7146947611822525739", official: true, caption: "Transformation Church is officially re-opening… HERE is Holy 📍" },
  { url: "https://www.tiktok.com/@4intheam/video/7176640425548107051", caption: "Pastor Michael Todd #God #jesuslovesyou #holyspirit #christiantiktok" },
  // Scripture — YouVersion Bible App and BibleProject
  { url: "https://www.tiktok.com/@youversion/video/7492423888324873518", official: true, caption: "“You, my brothers and sisters, were called to be free… serve one another humbly in love.” Galatians 5:13" },
  { url: "https://www.tiktok.com/@youversion/video/7490998287529643310", official: true, caption: "The Chosen is taking over Guided Scripture in the Bible App 📖" },
  { url: "https://www.tiktok.com/@bibleproject/video/6888744673180011781", official: true, caption: "Choosing a #Bible translation" },
  // Gospel worship clips (African gospel and more)
  { url: "https://www.tiktok.com/@famouzgospel/video/7253369391885077765", caption: "Tobechukwu — Nathaniel Bassey × Mercy Chinwo #gospel #worship" },
  { url: "https://www.tiktok.com/@famouzgospel/video/7203071185662315782", caption: "Tobechukwu (live) — Nathaniel Bassey × Mercy Chinwo #worship" },
  { url: "https://www.tiktok.com/@gospelhotspot/video/7224357149919595782", caption: "Tobechukwu (Praise God) #gospel", size: [480, 480] },
  { url: "https://www.tiktok.com/@believespecial/video/7430779352448716038", caption: "Father of Spirits — Theophilus Sunday #worship" },
  { url: "https://www.tiktok.com/@nathanielblow1/video/7225648064319507717", caption: "Holy Spirit carry me go #nathanielbassey #holyspirit" },
  { url: "https://www.tiktok.com/@agapelegacy/video/7503223503613676855", caption: "Nathaniel Bassey #worshipmusic #gospel", size: [576, 768] },
  { url: "https://www.tiktok.com/@gmfg_tv_official/video/7365413526896233736", caption: "Amazing God — Mercy Chinwo #gospelmusic #worship" },
  { url: "https://www.tiktok.com/@lidu.c/video/7251988774714985733", caption: "Until Grace — CeCe Winans + Tauren Wells #Jesus #Grace", size: [576, 828] },
  { url: "https://www.tiktok.com/@dripires15/video/7073284394898885934", caption: "Come Again — Elevation Worship × Maverick City #worship" },
  { url: "https://www.tiktok.com/@pawalajanyan/video/7245236206068387078", caption: "Wait On You (Part II) #worship" },
  { url: "https://www.tiktok.com/@khayamthethwa0/video/7306163880013696262", caption: "Verse of the Day on the YouVersion Bible App #christiantiktok #bible" },
  { url: "https://www.tiktok.com/@vickmodidit/video/7319557774675905797", caption: "El Roi declarations 🙏 #NSPPD #prayers" },
  { url: "https://www.tiktok.com/@kerigan.denae/video/7210527390395780398", caption: "Tips for new Christians: Verse of the Day, BibleProject and more #christiantiktok" },
];
