// ============================================================
// data.js — 16タイプ定義 + 詳細解説(Phase 3) + ビジュアル指示(Phase 5相当)
// 命名・トーンは types.md / rules.md / feedback_tone_neutral.md に準拠
// scoring の key はパロディ名。questions.js と完全一致させること。
// ============================================================

// Z世代(10-40代)が直感的に分かる12ジャンル。
// 削除済(通じない/被る/該当曲ゼロ):
//   ロック / バンド / ジャズ・ソウル / クラシック・インスト /
//   アコースティック・弾き語り / インディー / シティポップ /
//   アイドル(→ 女性アイドル/男性アイドル 分割)
// リネーム:
//   洋楽ポップ → 洋楽 / EDM・ダンス → ダンス / ヒップホップ・ラップ → ラップ/HIPHOP
const GENRES = [
  "昭和歌謡曲", "平成ソング", "令和J-POP",   // 世代別3つを先頭に
  "K-POP", "洋楽", "邦ロック",
  "シティポップ/R&B", "ラップ/HIPHOP", "ダンス",
  "ボカロ", "アニソン", "バラード",
  "女性アイドル", "男性アイドル"
];

// 各タイプ: type(正式), parody(主表示), tagline(1行), definition, description(本文約200-280字),
// compatible(相性タイプ parody名), color/accent(カードカラー), motif(モチーフ語)
const TYPES = [
  {
    key: "バイブス警察", type: "バイブス型", definition: "直感・衝動で恋に落ちる",
    tagline: "理屈はあと。先に心が動いてる。",
    color: "#FF5E7E", accent: "#FFD166", motif: "稲妻 / ネオン",
    compatible: ["ときめきパパラッチ", "情熱ラブゾンビ"],
    description:
      "考えるより先に、もう好きになってる。第一印象とその場の空気を信じて飛び込めるのが強み。スピード感のある関係ほど燃えるし、ピンとこない相手にダラダラ時間を使わない潔さもある。たまにノリで動いて「ちょっと早まったかも」と思う夜もあるけれど、その瞬発力ごと魅力。恋を頭で固めず、体温で進める人。同じ熱量で走れる相手と組むと一気に距離が縮まる。"
  },
  {
    key: "運命マジシャン", type: "運命型", definition: "運命を信じる",
    tagline: "この出会い、ぜったい意味がある。",
    color: "#7C5CFF", accent: "#E0C3FC", motif: "星座 / 月",
    compatible: ["進撃のロマンチスト", "ピュアエンジェル"],
    description:
      "偶然を必然に変える物語の感度が、人より一段高い人。誕生日の数字、すれ違ったタイミング、流れてた曲——全部に意味を読みに行く。そのぶん、ここぞの相手に深く心を寄せられるし、待つことも怖くない。「運命だから」と相手を理想化しすぎてしまう瞬間もあるけれど、その信じる力こそ関係を特別なものに育てる。物語の主人公みたいな恋を、本気でやれるタイプ。"
  },
  {
    key: "進撃のロマンチスト", type: "ロマンティック型", definition: "現実をドラマっぽく演出したい",
    tagline: "どうせなら、映画みたいな恋がいい。",
    color: "#FF7AB6", accent: "#FFE5F0", motif: "薔薇 / フィルム",
    compatible: ["運命マジシャン", "ときめきパパラッチ"],
    description:
      "何気ない日常を、特別なシーンに変える演出力がある人。デートの場所も、BGMも、セリフも、頭の中ではもう完成してる。理想の世界観がはっきりしているぶん、現実とのギャップに戸惑う瞬間もあるけれど、その「素敵なものを信じる力」が関係に彩りと余韻を残す。ベタを本気で愛せるのは才能。一緒にその世界観に乗ってくれる相手と、人生レベルで色が変わる。"
  },
  {
    key: "一途ペンギン", type: "一途型", definition: "自分が他を見ない・ぶれない",
    tagline: "決めたら、わき目もふらない。",
    color: "#3AA0FF", accent: "#CDEAFF", motif: "ペンギン / 氷",
    compatible: ["慎重うさぎ", "ピュアエンジェル"],
    description:
      "一度好きになったら、ほんとうに他が見えなくなる人。心が決まれば迷わない、目移りという概念がない。安定した関係を育てるのが得意で、相手に「この人といれば大丈夫」と思わせられる。想いが強いぶん、尽くしすぎて自分を後回しにしたり、変化を恐れる瞬間もあるけれど、その変わらない誠実さは何より信頼される。長く隣にいる人になるなら、この人が強い。"
  },
  {
    key: "ヤキモチモンスター", type: "ヤキモチ型", definition: "取られたくない・嫉妬",
    tagline: "あなたを、誰にも渡したくない。",
    color: "#FF4D4D", accent: "#FFC9C9", motif: "炎 / ハート",
    compatible: ["一途ペンギン", "情熱ラブゾンビ"],
    description:
      "ヤキモチは、本気で好きな証拠。相手のちょっとした態度の変化にもすぐ気づける愛情深さがある。「私だけを見てほしい」と思える純度の高さは、誰にでもあるものじゃない。モヤモヤを一人で抱え込んだり、相手の人間関係が気になりすぎる瞬間もあるけれど、その温度を素直に伝えられた時に最大の魅力になる。冷めた関係には絶対ならないタイプ。同じ熱量で応えてくれる相手と相性がいい。"
  },
  {
    key: "推し活ベビー", type: "推し活型", definition: "尽くす・貢ぐ・応援する",
    tagline: "あなたの幸せが、わたしの幸せ。",
    color: "#FF8FB1", accent: "#FFE0EC", motif: "リボン / ペンライト",
    compatible: ["一途ペンギン", "ピュアエンジェル"],
    description:
      "相手の好きなものを覚えて、さりげなく差し出せる人。気遣いの精度がとにかく高く、観察力とまめさは誰にでもできることじゃない。尽くすこと自体が愛情表現で、与えることに幸せを感じられる。一方で、頑張りすぎて自分を後回しにしたり、見返りのなさに疲れてしまう夜もある。自分を大切にできた瞬間、その愛は何倍にもなって戻ってくる。受け取り上手な相手とハマる。"
  },
  {
    key: "チル仙人", type: "チル型", definition: "お互いの時間尊重・余白",
    tagline: "ほどよい距離が、いちばん心地いい。",
    color: "#36C9A8", accent: "#CFF5EC", motif: "山 / 雲",
    compatible: ["同志の虎", "ミステリアス狼"],
    description:
      "ベタベタしすぎない、ちょうどいい距離感を本能で知っている人。自分の時間も相手の時間も尊重できて、執着しないぶん相手も自然体でいられる。一緒にいて疲れない、長く続く関係の土台をつくれるのが強み。クールに見られて「ちゃんと好きなのか伝わってる?」と相手を不安にさせる瞬間もあるから、好きはたまに言葉でも。余白を一緒に味わえる相手と、人生のペースが合う。"
  },
  {
    key: "慎重うさぎ", type: "慎重型", definition: "ゆっくり進める",
    tagline: "急がない。でも、ちゃんと本気。",
    color: "#B79CFF", accent: "#EDE5FF", motif: "うさぎ / 新月",
    compatible: ["一途ペンギン", "同志の虎"],
    description:
      "勢いで動かない。相手をよく見て、信頼できると確かめてから心を開く誠実さがある人。関係が始まるまでは時間がかかるけど、始まれば長く大切に育てられる。考えすぎてタイミングを逃したり、踏み出すのにエネルギーがいる瞬間もあるけれど、その丁寧さこそが相手に「ちゃんと向き合ってくれている」という安心を与える。じっくり同じペースで歩める相手と、一番心地よく進める。"
  },
  {
    key: "同志の虎", type: "同志型", definition: "価値観・理解で結ばれる",
    tagline: "わかり合えるって、いちばん強い。",
    color: "#2EC4B6", accent: "#CBF3EF", motif: "コンパス / 天気図",
    compatible: ["チル仙人", "マブダチエイリアン"],
    description:
      "ドキドキより「わかり合えること」を選べる人。価値観や考え方が合う相手に強く惹かれて、語り合える関係に深い安心を感じる。感情に流されず、対等なパートナーシップを築けるのが大きな強み。理屈が先に立ちすぎて、ときめきを後回しにしてしまう瞬間もあるけれど、そのぶん関係は地に足がついて長続きする。同じ目線で未来を語れる相手と組むと、人生の戦友みたいになれる。"
  },
  {
    key: "マブダチエイリアン", type: "友達の延長型", definition: "友達から発展",
    tagline: "いちばんの友達が、いちばん好きな人に。",
    color: "#46C2FF", accent: "#D2F0FF", motif: "宇宙人 / 二つの星",
    compatible: ["同志の虎", "ピュアエンジェル"],
    description:
      "気取らない自然体の関係を、誰よりうまく築ける人。一緒にいて楽な空気をつくるのが本能でできる。恋人になっても友達のような対等さが続くのが魅力で、長く息の合うパートナーシップになる。友達の延長すぎて踏み込めなかったり、関係を壊すのが怖くて告白を先延ばしにする瞬間もあるけれど、その飾らない距離感は誰よりも深い信頼につながる。一歩踏み込む勇気が、世界を変える。"
  },
  {
    key: "ミステリアス狼", type: "ミステリアス型", definition: "謎めく・本心を見せない",
    tagline: "ぜんぶは、見せないでいたい。",
    color: "#6C63FF", accent: "#D6D2FF", motif: "狼 / 霧",
    compatible: ["チル仙人", "慎重うさぎ"],
    description:
      "本心はそう簡単に見せない。少し謎めいているくらいがちょうどいいと、本能でわかっている人。簡単に開かないぶん、本当に信頼した相手にだけ見せる素顔のギャップが強烈に効く。距離を取りすぎて誤解されたり、気持ちを言葉にするのが苦手で相手を不安にさせる瞬間もあるけれど、その奥行きと余白こそが人を惹きつけてやまない。「ちゃんと知りたい」と思わせる魅力を、自然に持ってる。"
  },
  {
    key: "ド直球ザウルス", type: "直球型", definition: "積極的・自分から動く",
    tagline: "好きなら、言う。それだけ。",
    color: "#FF7A45", accent: "#FFD9C2", motif: "恐竜 / 矢印",
    compatible: ["情熱ラブゾンビ", "ピュアエンジェル"],
    description:
      "好きになったら、迷うより先に一歩踏み出せる人。駆け引きせず、気持ちをそのまま言葉にできる潔さが最大の魅力。チャンスを逃さないし、ぐずぐずした関係を引きずらない。勢いがありすぎて相手のペースを置き去りにする瞬間もあるけれど、その裏表のなさは何より信頼される。「察して」が通じる相手より、まっすぐ受け止めてくれる相手と組んだ時、いちばんパワーが出る。"
  },
  {
    key: "ときめきパパラッチ", type: "ときめき重視型", definition: "刺激・ドキドキ追求",
    tagline: "心が震える瞬間を、追いかけてる。",
    color: "#FF5CA8", accent: "#FFD6EC", motif: "カメラ / フラッシュ",
    compatible: ["バイブス警察", "進撃のロマンチスト"],
    description:
      "胸が高鳴る瞬間のために、いつでも動けるエネルギーがある人。新鮮さを感じる関係ほど輝けるし、相手をドキドキさせる演出も得意。日常を一気にイベントに変える才能がある。刺激が落ち着くと物足りなくなる瞬間もあるけれど、その「ときめきを楽しむ感性」は関係をいつも新鮮に保つ最大の武器。同じテンションで遊んでくれる相手と組むと、付き合いが長くなっても二人だけずっと初々しい。"
  },
  {
    key: "情熱ラブゾンビ", type: "情熱型", definition: "感情の温度高い・愛を言葉で伝える",
    tagline: "好きの気持ち、止まらない。",
    color: "#FF3D6E", accent: "#FFCBD8", motif: "ハート / 炎",
    compatible: ["ド直球ザウルス", "ヤキモチモンスター"],
    description:
      "愛情の温度が、人より一段高い。好きの気持ちをまっすぐ言葉にできるから、相手には「愛されてる」がちゃんと届く。一度燃えると一途に突き進む熱量と、表現の素直さが最大の魅力。気持ちが溢れすぎて止まらなくなったり、温度差にこたえる瞬間もあるけれど、その全力で愛する姿勢は関係に確かな手応えを残す。同じ熱で受け止めてくれる相手と組むと、人生まるごと持っていかれる。"
  },
  {
    key: "沼っくま", type: "沼り型", definition: "自分がハマって抜け出せない",
    tagline: "ハマったら、もう抜け出せない。",
    color: "#A0522D", accent: "#E8D5C0", motif: "くま / 沼",
    compatible: ["ミステリアス狼", "情熱ラブゾンビ"],
    description:
      "一度ハマったら、頭の中がその人でいっぱいになる人。相手の小さな仕草、何気ない一言、写真の指の角度——ぜんぶ愛おしく感じられる感受性がある。それだけ深く愛せるということ。のめり込みすぎて自分を見失う瞬間もあるけれど、その全身で恋に浸れる力は、何にも代えがたい愛情の深さ。「ちゃんと深さを受け止めてくれる相手」と出会えた時、人生でいちばん幸せになるタイプ。"
  },
  {
    key: "ピュアエンジェル", type: "ピュア型", definition: "素直・まっすぐ・初恋気質",
    tagline: "まっすぐな気持ちが、いちばんの武器。",
    color: "#FFAFCC", accent: "#FFE8F0", motif: "天使 / 羽",
    compatible: ["一途ペンギン", "マブダチエイリアン"],
    description:
      "気持ちに素直で、いつまでも初恋みたいな純度を持っている人。駆け引きをせず、まっすぐ人を好きになれる素直さが最大の魅力。相手を疑わず信じられる優しさが、相手にとっての安心になる。純粋すぎて傷つきやすかったり、理想と現実のギャップに戸惑う瞬間もあるけれど、その澄んだ気持ちは何より人の心を動かす。同じ素直さを持った相手と、穏やかに育てていける恋になる。"
  }
];

// ------------------------------------------------------------
// 結果ページ用の濃いコンテンツ(16personalities / ラブキャラ64 を参考に多セクション化)
// strengths=恋愛の強み3つ / loved=愛されポイント(短い決め台詞) / ideal=こんな恋がしたい
// caution=伸びしろ(ポジに包む) / cautionMatch=ちょっと注意な相性 / aruaru=あるある5つ
// ------------------------------------------------------------
const DETAILS = {
  "バイブス警察": {
    strengths: ["『この人だ』のセンサーが速くて当たる", "場の空気を一瞬で読み取れる", "迷う時間が短くて行動が早い"],
    loved: "一緒にいると毎日がイベントみたいに楽しい。",
    ideal: "出会った瞬間に「これだ」と思える恋。心が動いた方向に、二人で走り出せる関係。",
    caution: "勢いで動いたあと冷静になる瞬間も。直感は信じつつ、立ち止まる余白も自分にあげて。",
    cautionMatch: ["慎重うさぎ"],
    aruaru: [
      "気づいたらもう好きになってる",
      "『なんとなく』で決めて結果当たる",
      "スロースタートな相手にやきもき",
      "テンション低い日は世界が無に見える",
      "『直感で選んだ服』がだいたい褒められる"
    ]
  },
  "運命マジシャン": {
    strengths: ["巡り合わせを信じ抜く強さ", "ここぞの相手に深く心を寄せられる", "待つことが怖くない"],
    loved: "『運命だね』と思わせてくれる特別感。",
    ideal: "偶然が必然に変わるような出会い。意味のある一瞬を、二人で重ねていける恋。",
    caution: "理想を重ねすぎて目の前のその人を見落とす瞬間も。現実のその人ごと愛して。",
    cautionMatch: ["チル仙人"],
    aruaru: [
      "小さな偶然に意味を探してしまう",
      "この曲が流れた=サインだと思う",
      "記念日と数字に弱い",
      "誕生日が近い人にときめきがち",
      "『運命じゃなかったかも』と気づいた瞬間が一番つらい"
    ]
  },
  "進撃のロマンチスト": {
    strengths: ["日常を特別なシーンに変える演出力", "雰囲気づくりの感度", "余韻を残すセンス"],
    loved: "一緒にいると物語の主人公になれる。",
    ideal: "映画のワンシーンみたいな恋。世界観を共有できる相手と、二人だけの物語を紡ぐ関係。",
    caution: "理想の世界観が強くなる瞬間も。現実とのギャップごと愛おしむと、もっと豊かになる。",
    cautionMatch: ["同志の虎"],
    aruaru: [
      "シチュエーションを脳内で先に作る",
      "BGMから決める",
      "ベタを本気で愛せる",
      "雨の日のデートに謎の高揚",
      "別れ際の『振り向く』に意味を読みすぎる"
    ]
  },
  "一途ペンギン": {
    strengths: ["決めた人にまっすぐ向かう誠実さ", "安心感を与える存在感", "関係を長く育てる持続力"],
    loved: "ずっと変わらず想ってくれる安心感。",
    ideal: "ずっと隣にいられる穏やかな恋。派手じゃなくていい、ちゃんと続いていく関係。",
    caution: "尽くしすぎて自分を後回しにしがち。自分の時間も、ちゃんと大事に。",
    cautionMatch: ["ときめきパパラッチ"],
    aruaru: [
      "一度好きになると本当に長い",
      "目移りという概念がない",
      "記念日はちゃんと覚えてる",
      "周りに紹介された人にもピンとこない",
      "好きじゃない人と話す気力が出ない"
    ]
  },
  "ヤキモチモンスター": {
    strengths: ["愛情の濃さがそのまま強み", "相手の変化を一瞬で察知", "本気度の高さ"],
    loved: "それだけ本気で想ってくれてる実感。",
    ideal: "お互いだけを見つめ合える恋。安心して独占しあえる、濃い関係。",
    caution: "モヤモヤを抱え込みがち。言葉にすると、ちゃんと伝わる。",
    cautionMatch: ["チル仙人"],
    aruaru: [
      "既読のタイミングが気になる",
      "『誰と行ったの?』が口ぐせ",
      "本当はかなり寂しがり",
      "相手の元カノのSNSを一度は見たことがある",
      "『大丈夫』と言いながら大丈夫じゃない"
    ]
  },
  "推し活ベビー": {
    strengths: ["相手の好きを覚える観察力", "気遣いのまめさ", "相手を笑顔にする才能"],
    loved: "さりげなく支えてくれる優しさ。",
    ideal: "応援し合えるあったかい恋。お互いの好きを、お互いが応援できる関係。",
    caution: "頑張りすぎて疲れる瞬間も。自分のごきげんも、自分でちゃんと取って。",
    cautionMatch: ["ミステリアス狼"],
    aruaru: [
      "相手の好きを全部メモしてる",
      "プレゼント選びに本気を出しすぎる",
      "喜ぶ顔が一番のご褒美",
      "気づくと相手の予定を全部覚えてる",
      "自分の好きを聞かれるとちょっと困る"
    ]
  },
  "チル仙人": {
    strengths: ["疲れない距離感のセンス", "相手の自由を尊重できる余裕", "長続きの安定感"],
    loved: "一緒にいて疲れない心地よさ。",
    ideal: "余白のあるゆるやかな恋。ベタつかず、でもちゃんと繋がっている関係。",
    caution: "クールに見られがち。好きはたまに、ちゃんと言葉にしてあげて。",
    cautionMatch: ["ヤキモチモンスター"],
    aruaru: [
      "連絡はマイペース",
      "一人の時間がないと無理",
      "重い空気がちょっと苦手",
      "『察して』を自分は使わないし使われたくない",
      "『今日会えない』に意外と平気"
    ]
  },
  "慎重うさぎ": {
    strengths: ["相手をよく見る誠実さ", "信頼を築く丁寧さ", "決めた後の覚悟"],
    loved: "じっくり向き合ってくれる丁寧さ。",
    ideal: "時間をかけて育てる確かな恋。一歩ずつ、本物の信頼を重ねていく関係。",
    caution: "考えすぎてタイミングを逃すことも。一歩踏み出す勇気は、ちゃんと持ってる。",
    cautionMatch: ["バイブス警察"],
    aruaru: [
      "告白までが本当に長い",
      "石橋を叩いて渡る",
      "でも一度決めたら強い",
      "初デート前に何時間も悩む",
      "『この人で大丈夫?』を友達に何回も聞く"
    ]
  },
  "同志の虎": {
    strengths: ["価値観の合う人を見抜く目", "対等なパートナーシップ", "本音で語り合う安心感"],
    loved: "本音で分かり合える安心感。",
    ideal: "並んで同じ未来を見られる恋。一緒に人生を組み立てていく戦友みたいな関係。",
    caution: "理屈が先に立つ瞬間も。ときめきも、ちゃんと信じていい。",
    cautionMatch: ["進撃のロマンチスト"],
    aruaru: [
      "デートは会話が一番楽しい",
      "価値観が合うと一気に距離が縮まる",
      "条件より中身を見る",
      "話が合わない人にはすぐ冷める",
      "『未来の話』が一番好き"
    ]
  },
  "マブダチエイリアン": {
    strengths: ["自然体の関係づくり", "気を遣わせない居心地のよさ", "対等な空気を保てる"],
    loved: "親友みたいに何でも話せる安心感。",
    ideal: "親友がそのまま恋人になる恋。気取らない、でもいちばん深い関係。",
    caution: "踏み込めず友達のままで終わる瞬間も。勇気を出す価値は、ちゃんとある。",
    cautionMatch: ["運命マジシャン"],
    aruaru: [
      "友達期間がやたら長い",
      "タメ口の距離感が好き",
      "告白で関係が変わるのが本当に怖い",
      "『付き合う前と何が違うんだろう』って言われがち",
      "周りから『お似合い』と何回も言われてる"
    ]
  },
  "ミステリアス狼": {
    strengths: ["独特の余白と奥行き", "信頼した人にだけ見せるギャップ", "ムードを作る空気感"],
    loved: "本当の自分を見せてもらえる特別感。",
    ideal: "二人だけの秘密みたいな恋。誰にも見せない素顔を、一人にだけ預ける関係。",
    caution: "距離を取りすぎて誤解される瞬間も。気持ちは少しでいいから、言葉にして。",
    cautionMatch: ["推し活ベビー"],
    aruaru: [
      "本心はあまり見せない",
      "聞き役になりがち",
      "実はめちゃくちゃ情に厚い",
      "『何考えてるか分からない』と言われがち",
      "信頼した人にだけ突然甘える"
    ]
  },
  "ド直球ザウルス": {
    strengths: ["まっすぐ動く行動力", "駆け引きをしない潔さ", "チャンスを逃さない瞬発力"],
    loved: "好きをまっすぐ伝えてくれる安心感。",
    ideal: "気持ちを隠さない正直な恋。お互いに本音で向き合える、シンプルな関係。",
    caution: "勢いで相手を置きがち。ペースも合わせると、もっと届く。",
    cautionMatch: ["慎重うさぎ"],
    aruaru: [
      "好きならその日に言う",
      "駆け引きが本当に苦手",
      "裏表がない",
      "『匂わせ』の意味がよくわからない",
      "察するより聞きたいタイプ"
    ]
  },
  "ときめきパパラッチ": {
    strengths: ["関係を新鮮に保つ感性", "刺激を楽しめる柔軟さ", "ドキドキを作り出す演出力"],
    loved: "一緒にいるとずっと胸が高鳴る。",
    ideal: "毎回ときめける刺激的な恋。慣れても新鮮さを失わない、輝き続ける関係。",
    caution: "刺激が落ち着くと物足りなさも。安定の良さも、ちゃんと味わって。",
    cautionMatch: ["一途ペンギン"],
    aruaru: [
      "マンネリがいちばん苦手",
      "サプライズが大好き",
      "追われるより追いたい",
      "ドラマみたいな再会に弱い",
      "『普通の日常』に少しソワソワする"
    ]
  },
  "情熱ラブゾンビ": {
    strengths: ["温度の高い愛情表現", "一途に突き進む熱量", "『愛されてる』を実感させる力"],
    loved: "全力で愛してくれる手応え。",
    ideal: "熱量を全部ぶつけ合える恋。お互いに本気を隠さない、濃い関係。",
    caution: "気持ちが溢れて止まらなくなる瞬間も。時々は深呼吸して、自分を冷ましてあげて。",
    cautionMatch: ["チル仙人"],
    aruaru: [
      "好きが言葉で勝手に溢れる",
      "連絡は基本マメ",
      "冷められると一番こたえる",
      "好きな人の話を友達にしすぎる",
      "『愛してる』にためらいがない"
    ]
  },
  "沼っくま": {
    strengths: ["深く愛せる没入力", "相手の魅力に気づく感受性", "一途に注げる熱"],
    loved: "とことん夢中になってくれる深さ。",
    ideal: "抜け出せないくらい夢中になる恋。お互いに深く深く入り込める関係。",
    caution: "のめり込んで自分を見失う瞬間も。自分軸も、ちゃんと持っていて。",
    cautionMatch: ["チル仙人"],
    aruaru: [
      "ハマると一日中その人のことを考えてる",
      "相手の小さな仕草も愛おしい",
      "気づけば沼の底",
      "好きな人のSNSを全部遡る",
      "『この人以外考えられない』をすぐ言う"
    ]
  },
  "ピュアエンジェル": {
    strengths: ["まっすぐ好きになれる素直さ", "相手を信じる優しさ", "純度の高い愛情"],
    loved: "裏表なくまっすぐ向き合ってくれる。",
    ideal: "初恋みたいにきゅんとする恋。何度でも純粋に好きでいられる関係。",
    caution: "純粋ゆえ傷つきやすい瞬間も。自分を守る強さも、少しずつ。",
    cautionMatch: ["ミステリアス狼"],
    aruaru: [
      "駆け引きがそもそもできない",
      "好きが顔に出る",
      "信じた人を疑えない",
      "『嘘ついてない?』と聞かれる方が傷つく",
      "好きな人の前だと声のトーンが上がる"
    ]
  }
};

// key(=パロディ名)を parody としても参照できるように補完 + DETAILS をマージ
TYPES.forEach(t => { t.parody = t.key; Object.assign(t, DETAILS[t.key] || {}); });

// key で引くためのマップ
const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.key, t]));

// 「系」= 16タイプ×4系で 64 通りのレア感(ラブタイプ64寄せ)。
// 回答スコアの傾向から、本人タイプに被さる“系”を1段付ける。
const KEI = {
  "溺愛系":     { types: ["沼っくま", "情熱ラブゾンビ", "ヤキモチモンスター", "推し活ベビー"], desc: "愛が深くて一直線" },
  "ピュア系":   { types: ["ピュアエンジェル", "一途ペンギン", "運命マジシャン", "進撃のロマンチスト"], desc: "まっすぐで夢見がち" },
  "マイペース系": { types: ["チル仙人", "ミステリアス狼", "慎重うさぎ", "同志の虎"], desc: "自分の世界を大切に" },
  "アクティブ系": { types: ["バイブス警察", "ド直球ザウルス", "ときめきパパラッチ", "マブダチエイリアン"], desc: "勢いと刺激で動く" }
};

// 同点時の優先順位(questions.md より。希少タイプ優先)
const TIE_PRIORITY = [
  "ヤキモチモンスター", "ド直球ザウルス", "ミステリアス狼", "進撃のロマンチスト",
  "マブダチエイリアン", "運命マジシャン", "ピュアエンジェル", "推し活ベビー",
  "バイブス警察", "ときめきパパラッチ", "情熱ラブゾンビ", "同志の虎",
  "沼っくま", "チル仙人", "一途ペンギン", "慎重うさぎ"
];

// ============================================================
// CLUSTERS — リスナー層(音楽の好みクラスタ)。タイプスコア(=恋愛観)とは
// 別軸で「同じ層のファンが好むサウンド」を縛るためのもの。
// 「ミセスファンに Kroi 出ない」「K-POP ファンにアニソン出ない」を構造的に解決。
// 各曲は所属アーティスト経由で複数 cluster に属する(主役+副も可)。
// ============================================================
const CLUSTERS = {
  JPOP_MAIN:     "J-POP王道",
  INDIE_ROCK:    "邦ロック・インディー",
  ROCK_CLASSIC:  "邦ロック王道",
  KPOP:          "K-POP",
  ANISON_VOCALO: "アニソン・ボカロ",
  HIPHOP_RNB:    "ヒップホップ・R&B",
  DIVA_BALLAD:   "バラード歌姫",
  CITYPOP:       "シティポップ",
  WPOP:          "洋楽ポップ",
  JOHNNYS:       "男性アイドルグループ",
  IDOL_F:        "女性アイドル",
  HEISEI:        "平成ソング",  // 1990-2010 ヒット曲(Z世代から見て親世代の音楽)
  SHOWA:         "昭和歌謡曲",  // 1970-80年代:シティポップ+フォーク+歌謡
  REIWA:         "令和J-POP"    // 2019-現在:Z世代の主戦場
};

// 全 234 アーティストを 1-3 cluster に振り分け。複数所属可(両刀OK)。
// 振り分けは「実際にそのアーティストのファンが聴いてる他のアーティスト傾向」をベースに、
// ジャンル単独ではなく「リスナー層」を意識して分類している(2026-06-22)。
const ARTIST_CLUSTERS = {
  // ── J-POP王道(売れ線・メインストリーム)──
  "Official髭男dism": ["JPOP_MAIN", "REIWA"],
  "Mrs. GREEN APPLE": ["JPOP_MAIN", "REIWA"],
  "Vaundy": ["JPOP_MAIN", "INDIE_ROCK", "REIWA"],
  "優里": ["JPOP_MAIN", "REIWA"],
  "Saucy Dog": ["JPOP_MAIN", "INDIE_ROCK", "REIWA"],
  "back number": ["JPOP_MAIN", "REIWA"],
  "あいみょん": ["JPOP_MAIN", "INDIE_ROCK"],
  "King Gnu": ["JPOP_MAIN", "INDIE_ROCK", "REIWA"],
  "緑黄色社会": ["JPOP_MAIN", "INDIE_ROCK", "REIWA"],
  "藤井 風": ["JPOP_MAIN", "CITYPOP", "HIPHOP_RNB", "REIWA"],
  "米津玄師": ["JPOP_MAIN", "ROCK_CLASSIC", "REIWA"],
  "SEKAI NO OWARI": ["JPOP_MAIN", "ROCK_CLASSIC", "REIWA"],
  "スキマスイッチ": ["JPOP_MAIN", "ROCK_CLASSIC"],
  "Tani Yuuki": ["JPOP_MAIN", "HEISEI", "REIWA"],
  "wacci": ["JPOP_MAIN", "HEISEI", "REIWA"],
  "西野カナ": ["JPOP_MAIN", "DIVA_BALLAD", "HEISEI"],
  "GReeeeN": ["JPOP_MAIN", "HEISEI", "REIWA"],
  "FUNKY MONKEY BABYS": ["JPOP_MAIN", "HEISEI"],
  "ナオト・インティライミ": ["JPOP_MAIN", "HEISEI"],
  "Aqua Timez": ["JPOP_MAIN", "ROCK_CLASSIC", "HEISEI"],
  "ケツメイシ": ["JPOP_MAIN", "HIPHOP_RNB", "HEISEI"],
  "mihimaru GT": ["JPOP_MAIN"],
  "平井大": ["JPOP_MAIN"],
  "高橋優": ["JPOP_MAIN", "INDIE_ROCK", "HEISEI"],
  "DREAMS COME TRUE": ["JPOP_MAIN", "DIVA_BALLAD", "HEISEI"],
  "AAA": ["JPOP_MAIN", "DIVA_BALLAD", "HEISEI"],
  "EXILE": ["JPOP_MAIN", "JOHNNYS", "HEISEI"],                      // LDH ボーイズグループも「男性アイドル」に内包
  "三代目 J Soul Brothers": ["JPOP_MAIN", "JOHNNYS", "HEISEI"],     // 同上
  "Novelbright": ["JPOP_MAIN", "INDIE_ROCK", "REIWA"],
  "瑛人": ["JPOP_MAIN", "INDIE_ROCK", "REIWA"],
  "菅田将暉": ["JPOP_MAIN", "INDIE_ROCK", "REIWA"],
  "いきものがかり": ["JPOP_MAIN", "DIVA_BALLAD", "HEISEI"],
  "つじあやの": ["JPOP_MAIN", "DIVA_BALLAD"],
  "広瀬香美": ["JPOP_MAIN", "DIVA_BALLAD"],
  "Rake": ["JPOP_MAIN", "DIVA_BALLAD", "HEISEI"],
  "桐谷健太": ["JPOP_MAIN", "DIVA_BALLAD", "HEISEI"],
  "河口恭吾": ["JPOP_MAIN", "DIVA_BALLAD"],
  "ZARD": ["JPOP_MAIN", "DIVA_BALLAD", "HEISEI"],

  // ── インディー邦ロック(Kroi/TOMOO系のサブカル寄り)──
  "TOMOO": ["INDIE_ROCK", "REIWA"],
  "sumika": ["INDIE_ROCK", "JPOP_MAIN", "REIWA"],
  "羊文学": ["INDIE_ROCK", "REIWA"],
  "Tele": ["INDIE_ROCK", "REIWA"],
  "マカロニえんぴつ": ["INDIE_ROCK", "REIWA"],
  "君島大空": ["INDIE_ROCK", "REIWA"],
  "クリープハイプ": ["INDIE_ROCK", "REIWA"],
  "Hump Back": ["INDIE_ROCK", "REIWA"],
  "SHE'S": ["INDIE_ROCK", "REIWA"],
  "REISAI": ["INDIE_ROCK", "REIWA"],
  "reGretGirl": ["INDIE_ROCK", "REIWA"],
  "imase": ["INDIE_ROCK", "JPOP_MAIN", "REIWA"],
  "indigo la End": ["INDIE_ROCK", "REIWA"],
  "ずっと真夜中でいいのに。": ["ANISON_VOCALO", "INDIE_ROCK", "REIWA"],
  "yama": ["INDIE_ROCK", "ANISON_VOCALO", "REIWA"],
  "もさを。": ["INDIE_ROCK", "JPOP_MAIN", "REIWA"],
  "カネヨリマサル": ["INDIE_ROCK", "REIWA"],
  "マルシィ": ["INDIE_ROCK", "REIWA"],
  "My Hair is Bad": ["INDIE_ROCK"],
  "きのこ帝国": ["INDIE_ROCK"],
  "コレサワ": ["INDIE_ROCK"],
  "ミオヤマザキ": ["INDIE_ROCK", "REIWA"],
  "なるみや": ["INDIE_ROCK", "REIWA"],
  "UMEILO": ["INDIE_ROCK", "REIWA"],
  "SIX LOUNGE": ["INDIE_ROCK", "REIWA"],
  "Suchmos": ["INDIE_ROCK", "CITYPOP", "HIPHOP_RNB"],
  "Lamp": ["INDIE_ROCK", "CITYPOP"],
  "Bonobos": ["INDIE_ROCK", "CITYPOP"],
  "椎名林檎": ["INDIE_ROCK", "JPOP_MAIN", "HEISEI"],
  "星野源": ["INDIE_ROCK", "JPOP_MAIN", "HEISEI"],
  "真心ブラザーズ": ["INDIE_ROCK", "ROCK_CLASSIC"],
  "『ユイカ』": ["INDIE_ROCK", "JPOP_MAIN", "REIWA"],
  "Friday Night Plans": ["INDIE_ROCK", "CITYPOP", "HIPHOP_RNB", "REIWA"],
  "SHISHAMO": ["INDIE_ROCK"],
  "amazarashi": ["INDIE_ROCK", "ROCK_CLASSIC"],
  "Cocco": ["INDIE_ROCK", "ROCK_CLASSIC"],

  // ── 邦ロック王道(Mr.Children/RADWIMPS/BUMP系)──
  "Mr.Children": ["ROCK_CLASSIC", "HEISEI"],
  "RADWIMPS": ["ROCK_CLASSIC", "INDIE_ROCK", "HEISEI"],
  "BUMP OF CHICKEN": ["ROCK_CLASSIC", "HEISEI"],
  "UNISON SQUARE GARDEN": ["ROCK_CLASSIC", "INDIE_ROCK"],
  "スピッツ": ["ROCK_CLASSIC", "HEISEI"],
  "ASIAN KUNG-FU GENERATION": ["ROCK_CLASSIC", "INDIE_ROCK", "HEISEI"],
  "ONE OK ROCK": ["ROCK_CLASSIC", "HEISEI"],
  "ポルノグラフィティ": ["ROCK_CLASSIC", "HEISEI"],
  "GLAY": ["ROCK_CLASSIC", "HEISEI"],
  "サザンオールスターズ": ["ROCK_CLASSIC", "CITYPOP", "HEISEI", "SHOWA"],
  "MONGOL800": ["ROCK_CLASSIC", "HEISEI"],
  "HY": ["ROCK_CLASSIC", "HEISEI"],
  "TUBE": ["ROCK_CLASSIC", "JPOP_MAIN", "HEISEI"],
  "コブクロ": ["ROCK_CLASSIC", "JPOP_MAIN", "HEISEI"],
  "WANIMA": ["ROCK_CLASSIC", "JPOP_MAIN"],
  "KANA-BOON": ["ROCK_CLASSIC", "INDIE_ROCK"],
  "山崎まさよし": ["ROCK_CLASSIC", "DIVA_BALLAD"],
  "尾崎豊": ["ROCK_CLASSIC", "SHOWA"],
  "オフコース": ["ROCK_CLASSIC", "DIVA_BALLAD", "HEISEI", "SHOWA"],
  "CHAGE&ASKA": ["ROCK_CLASSIC", "SHOWA"],
  "風": ["ROCK_CLASSIC", "DIVA_BALLAD", "HEISEI", "SHOWA"],
  "井上陽水": ["ROCK_CLASSIC", "DIVA_BALLAD", "HEISEI", "SHOWA"],
  "THE 虎舞竜": ["ROCK_CLASSIC", "DIVA_BALLAD", "HEISEI", "SHOWA"],
  "中島みゆき": ["ROCK_CLASSIC", "DIVA_BALLAD", "HEISEI", "SHOWA"],
  "米米CLUB": ["JPOP_MAIN", "ROCK_CLASSIC", "SHOWA"],

  // ── K-POP ──
  "BTS": ["KPOP"],
  "BLACKPINK": ["KPOP"],
  "TWICE": ["KPOP"],
  "NewJeans": ["KPOP"],
  "IVE": ["KPOP"],
  "LE SSERAFIM": ["KPOP"],
  "aespa": ["KPOP"],
  "(G)I-DLE": ["KPOP"],
  "TXT": ["KPOP"],
  "ENHYPEN": ["KPOP"],
  "NCT 127": ["KPOP"],
  "SEVENTEEN": ["KPOP"],
  "Jung Kook": ["KPOP"],
  "Jennie": ["KPOP"],
  "LISA": ["KPOP"],
  "ROSÉ": ["KPOP", "REIWA"],
  "ROSÉ & Bruno Mars": ["KPOP", "WPOP"],
  "ILLIT": ["KPOP", "REIWA"],
  "FIFTY FIFTY": ["KPOP", "REIWA"],
  "BoA": ["KPOP", "JPOP_MAIN"],

  // ── アニソン・ボカロ ──
  "YOASOBI": ["ANISON_VOCALO", "JPOP_MAIN", "REIWA"],
  "LiSA": ["ANISON_VOCALO", "JPOP_MAIN"],
  "Aimer": ["ANISON_VOCALO", "DIVA_BALLAD", "REIWA"],
  "DECO*27": ["ANISON_VOCALO"],
  "HoneyWorks": ["ANISON_VOCALO"],
  "みきとP": ["ANISON_VOCALO"],
  "ヨルシカ": ["ANISON_VOCALO", "INDIE_ROCK", "REIWA"],
  "supercell": ["ANISON_VOCALO"],
  "Eve": ["ANISON_VOCALO", "INDIE_ROCK", "REIWA"],
  "Crusher-P": ["ANISON_VOCALO"],
  "バルーン": ["ANISON_VOCALO"],
  "Orangestar": ["ANISON_VOCALO"],
  "GARNiDELiA": ["ANISON_VOCALO"],
  "Kikuo": ["ANISON_VOCALO"],
  "てにをは": ["ANISON_VOCALO"],
  "40mP": ["ANISON_VOCALO"],
  "黒うさP": ["ANISON_VOCALO"],
  "n-buna": ["ANISON_VOCALO", "INDIE_ROCK"],
  "キタニタツヤ": ["ANISON_VOCALO", "INDIE_ROCK"],
  "花澤香菜": ["ANISON_VOCALO", "JPOP_MAIN"],
  "Ado": ["ANISON_VOCALO", "JPOP_MAIN", "REIWA"],
  "なとり": ["INDIE_ROCK", "ANISON_VOCALO", "REIWA"],

  // ── ヒップホップ・R&B ──
  "Awich": ["HIPHOP_RNB", "REIWA"],
  "Creepy Nuts": ["HIPHOP_RNB", "JPOP_MAIN", "REIWA"],
  "BASI": ["HIPHOP_RNB"],
  "SIRUP": ["HIPHOP_RNB", "CITYPOP", "REIWA"],
  "iri": ["HIPHOP_RNB", "CITYPOP", "REIWA"],
  "ちゃんみな": ["HIPHOP_RNB", "JPOP_MAIN", "REIWA"],
  "TENDRE": ["HIPHOP_RNB", "CITYPOP", "REIWA"],
  "湘南乃風": ["HIPHOP_RNB", "JPOP_MAIN", "HEISEI"],
  "加藤ミリヤ": ["HIPHOP_RNB", "DIVA_BALLAD"],

  // ── バラード歌姫 ──
  "MISIA": ["DIVA_BALLAD", "HEISEI"],
  "aiko": ["DIVA_BALLAD", "JPOP_MAIN", "HEISEI"],
  "中島美嘉": ["DIVA_BALLAD", "HEISEI"],
  "絢香": ["DIVA_BALLAD", "JPOP_MAIN", "HEISEI"],
  "JUJU": ["DIVA_BALLAD", "HEISEI"],
  "Superfly": ["DIVA_BALLAD", "ROCK_CLASSIC", "HEISEI"],
  "UA": ["DIVA_BALLAD", "INDIE_ROCK", "HEISEI"],
  "手嶌葵": ["DIVA_BALLAD", "HEISEI"],
  "平原綾香": ["DIVA_BALLAD", "HEISEI"],
  "大原櫻子": ["DIVA_BALLAD", "JPOP_MAIN", "HEISEI"],
  "YUI": ["DIVA_BALLAD", "ROCK_CLASSIC", "HEISEI"],
  "YUKI": ["DIVA_BALLAD", "INDIE_ROCK", "HEISEI"],
  "miwa": ["DIVA_BALLAD", "JPOP_MAIN", "HEISEI"],
  "milet": ["DIVA_BALLAD", "HEISEI", "REIWA"],
  "Uru": ["DIVA_BALLAD", "HEISEI", "REIWA"],
  "玉置浩二": ["DIVA_BALLAD", "ROCK_CLASSIC", "HEISEI", "SHOWA"],
  "浜崎あゆみ": ["DIVA_BALLAD", "JPOP_MAIN", "HEISEI"],
  "倖田來未": ["DIVA_BALLAD", "JPOP_MAIN", "HEISEI"],
  "倉木麻衣": ["DIVA_BALLAD", "JPOP_MAIN", "HEISEI"],
  "安室奈美恵": ["DIVA_BALLAD", "JPOP_MAIN", "HEISEI"],
  "一青窈": ["DIVA_BALLAD", "HEISEI"],
  "宇多田ヒカル": ["DIVA_BALLAD", "JPOP_MAIN", "HEISEI"],
  "大塚愛": ["DIVA_BALLAD", "JPOP_MAIN", "HEISEI"],
  "阿部真央": ["DIVA_BALLAD", "INDIE_ROCK"],
  "槇原敬之": ["DIVA_BALLAD", "JPOP_MAIN", "HEISEI"],
  "奥華子": ["DIVA_BALLAD", "ANISON_VOCALO"],
  "erica": ["DIVA_BALLAD"],
  "小林明子": ["DIVA_BALLAD", "HEISEI", "SHOWA"],
  "イルカ": ["DIVA_BALLAD", "HEISEI", "SHOWA"],
  "福山雅治": ["DIVA_BALLAD", "JPOP_MAIN", "HEISEI"],
  "平井堅": ["DIVA_BALLAD", "JPOP_MAIN", "HEISEI"],

  // ── シティポップ ──
  "竹内まりや": ["CITYPOP", "DIVA_BALLAD", "HEISEI", "SHOWA"],
  "山下達郎": ["CITYPOP", "HEISEI", "SHOWA"],
  "大滝詠一": ["CITYPOP", "HEISEI", "SHOWA"],
  "杏里": ["CITYPOP", "HEISEI", "SHOWA"],
  "松原みき": ["CITYPOP", "SHOWA"],
  "松任谷由実": ["CITYPOP", "DIVA_BALLAD", "HEISEI", "SHOWA"],
  "Awesome City Club": ["INDIE_ROCK", "CITYPOP"],

  // ── 洋楽ポップ ──
  "Taylor Swift": ["WPOP"],
  "Olivia Rodrigo": ["WPOP"],
  "Billie Eilish": ["WPOP"],
  "Adele": ["WPOP"],
  "Conan Gray": ["WPOP"],
  "Dua Lipa": ["WPOP"],
  "The Weeknd": ["WPOP"],
  "Sam Smith": ["WPOP"],
  "Ed Sheeran": ["WPOP"],
  "Lana Del Rey": ["WPOP"],
  "Sabrina Carpenter": ["WPOP"],
  "Maneskin": ["WPOP"],
  "The Neighbourhood": ["WPOP"],
  "Maroon 5": ["WPOP"],
  "Justin Bieber": ["WPOP"],
  "Justin Bieber & benny blanco": ["WPOP"],
  "The Kid LAROI & Justin Bieber": ["WPOP"],
  "Harry Styles": ["WPOP"],
  "Shawn Mendes": ["WPOP"],
  "Jason Mraz": ["WPOP"],
  "Jason Mraz & Colbie Caillat": ["WPOP"],
  "OneRepublic": ["WPOP"],
  "David Kushner": ["WPOP"],
  "Oasis": ["WPOP"],
  "Alan Walker": ["WPOP"],
  "The Chainsmokers": ["WPOP"],
  "Rihanna": ["WPOP", "HIPHOP_RNB"],
  "Zayn & Taylor Swift": ["WPOP"],
  "Doja Cat": ["WPOP", "HIPHOP_RNB"],
  "SZA": ["WPOP", "HIPHOP_RNB"],
  "Steve Lacy": ["WPOP", "HIPHOP_RNB"],
  "Jack Harlow": ["WPOP", "HIPHOP_RNB"],
  "Post Malone, Swae Lee": ["WPOP", "HIPHOP_RNB"],

  // ── 男性アイドルグループ(ジャニーズ + STARTO/LDH/ボーイズ系)──
  "嵐": ["JOHNNYS", "HEISEI"],
  "KAT-TUN": ["JOHNNYS", "HEISEI"],
  "関ジャニ∞": ["JOHNNYS", "HEISEI"],
  "KinKi Kids": ["JOHNNYS", "HEISEI"],
  "SMAP": ["JOHNNYS", "HEISEI"],
  "Hey!Say!JUMP": ["JOHNNYS"],
  "King & Prince": ["JOHNNYS"],
  "Snow Man": ["JOHNNYS"],
  "SixTONES": ["JOHNNYS"],
  "なにわ男子": ["JOHNNYS"],
  "BE:FIRST": ["JOHNNYS", "JPOP_MAIN"],
  "JO1": ["JOHNNYS", "JPOP_MAIN"],
  "INI": ["JOHNNYS", "JPOP_MAIN"],

  // ── 女性アイドル ──
  "乃木坂46": ["IDOL_F"],
  "欅坂46": ["IDOL_F"],
  "AKB48": ["IDOL_F"],
  "モーニング娘。": ["IDOL_F", "HEISEI"],
  "Flower": ["IDOL_F", "JPOP_MAIN", "HEISEI"],
  "SPEED": ["IDOL_F", "JPOP_MAIN", "HEISEI"],
  "松浦亜弥": ["IDOL_F", "JPOP_MAIN", "HEISEI"],
  "日向坂46": ["IDOL_F"],
  "櫻坂46": ["IDOL_F"],
  "=LOVE": ["IDOL_F"],
  "≠ME": ["IDOL_F"],
  "STU48": ["IDOL_F"],
  "Perfume": ["IDOL_F", "JPOP_MAIN"],
  "ももいろクローバーZ": ["IDOL_F"],
  "FRUITS ZIPPER": ["IDOL_F"],

  // ── 三浦大知は男性ボーカル枠 ──
  "三浦大知": ["JPOP_MAIN", "HIPHOP_RNB"]
};

// ジャンル選択もクラスタ推定の補助に使う(weight 0.5)。
// 「ロック」「インディー」など空振りジャンルもここで複数clusterに展開し、
// ブースト発火を実質増やす。
const GENRE_TO_CLUSTERS = {
  "K-POP": ["KPOP"],
  "洋楽": ["WPOP"],
  "邦ロック": ["ROCK_CLASSIC", "INDIE_ROCK"],
  "シティポップ/R&B": ["HIPHOP_RNB", "CITYPOP"],  // R&B(分かりにくい)とシティポップ(リバイバル)を統合
  "ラップ/HIPHOP": ["HIPHOP_RNB"],
  "ダンス": ["WPOP"],
  "ボカロ": ["ANISON_VOCALO"],
  "アニソン": ["ANISON_VOCALO"],
  "バラード": ["DIVA_BALLAD"],
  "昭和歌謡曲": ["SHOWA"],      // 1970-80年代ヒット
  "平成ソング": ["HEISEI"],     // 1990-2010 ヒット曲のリスナー層
  "令和J-POP": ["REIWA"],       // 2019-現在
  "女性アイドル": ["IDOL_F"],
  "男性アイドル": ["JOHNNYS"]  // ジャニーズ/STARTO/LDH/BMSG/JO1/INI 等の男性ボーイズグループ全般
};
