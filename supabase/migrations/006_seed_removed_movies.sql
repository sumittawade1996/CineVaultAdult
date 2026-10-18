-- 006_seed_removed_movies.sql
-- Seeds public.removed_movies so removed URLs answer 410 (or a 301 to a close hub).
insert into public.removed_movies (slug, redirect_to, reason) values
  ('brandi-love-jane-wilde-swapped-at-birth',null,'source video removed (2026-10-18)'),
  ('cant-resist-her-huge-ass-comatozze','/channel/comatozze','source video removed (2026-10-18)'),
  ('desi-girlfriend-fucking-tanker-scene',null,'source video removed (2026-10-18)'),
  ('hns385-boobs-ass-uncensored',null,'source video removed (2026-10-18)'),
  ('insane-shower-60fps-payton-preslee','/channel/nuru-massage','source video removed (2026-10-18)'),
  ('julie-cash-seductive-yoga-brazzers',null,'source video removed (2026-10-18)'),
  ('ks-hot-friend-4k-milf','/actor/kendra-sunderland','source video removed (2026-10-18)'),
  ('lena-paul-arqiv-285','/actor/lena-paul','source video removed (2026-10-18)'),
  ('lena-paul-college-girl-cant-stop-cumming','/actor/lena-paul','source video removed (2026-10-18)'),
  ('peta-jensen-bathroom-brunette',null,'source video removed (2026-10-18)'),
  ('real-couple-tender-morning-sex-creampie',null,'source video removed (2026-10-18)'),
  ('sneaky-with-a-booty-aria-banks',null,'source video removed (2026-10-18)'),
  ('soaking-wet-british-girl-begs-for-more',null,'source video removed (2026-10-18)'),
  ('yuu-shinoda-uncensored-jav-milf',null,'source video removed (2026-10-18)'),
  ('yuu-shinoda-stepmom-agreed-to-have-sex', null, 'renamed then removed (2026-10-18)')
on conflict (slug) do nothing;

-- Slugs that visitors requested but that are not in movies and have no rename redirect in netlify.toml.
insert into public.removed_movies (slug, reason)
select distinct p.slug, 'removed before 2026-10-18'
from (
  select regexp_replace(split_part(split_part(path, '?', 1), '#', 1), '^/movie/|/$', '', 'g') as slug
  from public.page_views where path like '/movie/%'
) p
where p.slug ~ '^[a-z0-9][a-z0-9-]*$'
  and not exists (select 1 from public.movies m where m.slug = p.slug)
  and p.slug <> all (array['sweet-cheating-with-stepson-reagan-foxx','latina-milf-share-bed-stepson-monique-fuentes','milky-boobs-stepson-private-room','son-fucks-stepmom-family-fucked-kourtney-love','step-mom-and-stepson-and-morning-wood-narration-version','obey-my-step-son','big-boobs-milky-stepmom-stepson','indian-step-daughter-step-dad-srimoyee','chitose-saegusa-forbidden-stepmom-erotic','curvy-stepsister-has-to-share-single-bed-with-stepbrother-at-hotel-because-only-one-room-left-ai-generated','dee-williams-perv-stepson-spying-stepmom','hot-pearl5-petite-stepsister-creampie','juan-loco-dee-williams-stepmom-sex-lessons','abbey-brooks-daughter-catches-stepmom','nikki-sexx-super-busty-milf-wants-stepson','hardcore-rough-sex-stepsister-indian','stepbrother-fucked-not-stepsister-family-vacation-resort','snuck-into-his-stepsisters-room','stepmom-will-take-care-jennifer-white','trying-to-make-a-good-first-impression-on-my-stepmother','emily-willis-stepsister-dick-pic','confession-my-stepson-fucked-me-in-the-hotel-bed-thinking-i-was-his-stepsister','the-american-step-sister','shinohara-iyo-stepfather-shower-uncensored','stepmom-lilly-james-canada','miyu-imai-stepson-uncensored','big-titty-stepsister-massage-cubbi-thompson','virgin-step-daughter-first-time-coco-lovelock','sugar-step-daddy-college-girl','lesbian-babe-stepsister-in-law-game-room-serena-blair-bunny-colby','unsatisfied-stepmom-charlie-forde','adriana-chechik-elexis-monroe-squirt-stepmom','stepmom-and-stepson-no-rules-left-narration-version','lauren-phillips-busty-stepmom','stepmom-comatozze-asks-stepson-for-a-massage','anissa-kate-best-stepmom-ever','crystal-chase-stepmom-take-shower','lindsay-lee-stepmom-shopping-list','monique-fuentes-colombian-stepmother-lesson','sharing-bed-husband-stepson-mistake','lauren-phillips-spikey-dee-stepmom-gf-video','mom-love-stepson-blair-williams','asian-stepmom-perfect-tits','busty-asian-stepmom-huge-tits','chitose-yura-forbidden-stepmom-erotic','stepmom-sharing-bed-with-son-brooklyn-chase','stepmothers-rough-threesome-monique-fuentes','stuck-up-stepmom-cory-chase-xander-corvus','nuru-massage-helps-seduce-stepson-in-the-shower','teach-little-stepsister-cell-phone-huge-cock','menopausal-step-mommy-orgy-cory-chase','lauren-phillips-sneaky-stepmom','katalina-kyle-sneaky-sex-with-step-sister','cant-resist-my-step-sisters-huge-ass-comatozze','my-stepsister-love-doing-it-solo','teen-stepsister-fuck-pussy-lia-little','krissy-lynn-kamryn-jade-step-father-figure','latina-babe-bath-step-brother-johnny-love','the-end-of-oak-street2'])
on conflict (slug) do nothing;

-- Slugs deleted on 2026-10-09 (backup deleted-movies-backup-2026-10-09.json).
insert into public.removed_movies (slug, reason)
select s, 'removed 2026-10-09' from unnest(array['bengali-teen-tuition-teacher-anal-homemade','chubby-bengali-bhabhi-fucked-by-young-neighbour','gorgeous-brunette-long-haired-fantasy','bed-sharing-stepmom-sis-taboo-threesome','stepmom-cyber-doll-is-a-good-wife-no-more-4k-60fps','bella-crystal-busty-stepsister-phone','german-vintage-feature-denise-la-bouche','tiny-little-step-daughter-sneaks-into-your-room-de','payton-preslee-obsessed-with-the-neighbor','horny-stepson-nuru-massage-stepmom-nina-elle','massage-nuru-nina-elle-ava-lauren','nervous-thick-ass-latina-model-amy-latina','bunny-colby-rimmed-neighbor','chubby-bengali-bhabhi-fucking-young-neighbour','aj-applegate-massages-father-in-law','koda-monroe-stepmom-craves-cock','payback-overload-lauren-phillips-dee-williams','jessie-rogers-stepmom-so-sexy','ryan-conner-virgin-boy-bimbo-milf','brandi-love-my-friends-hot-mom','meguri-obsessed-sons-friend-uncensored','ayumi-natsukawa-uncensored-stepmom-jav','curvy-blonde-embracing-her-sexuality-nuru-massage','markado-enigmatic-films-mayumi-yamanaka','mutiny-2','happiest-day-in-his-life-ensemble','lexi-luna-milf-try-on-haul','shay-fox-milf-full-scene','blake-blossom-top-tier-4k-hardcore','hot-ffm-scene','candice-dare-goodnight-poon','elli-nova-curvy-big-titty-loves','shes-a-queen-nagi-hikaru','miu-shiromine-jav-uncensored','blake-blossom-chloe-amour-lesbian-2k','angela-white-anal-full-hd','redhead-big-milkings-nala-brooks','russian-curvy-wife-hardcore','ava-addams-james-deen-xxx','thick-blonde-takes-big-dick-muscle-barbie','desi-big-boobs-bride-bbc','swinger-action-in-train-alex-black-shara-jones','tiamaria-rescue-mission','peta-jensen-pool-boy-shower','alexis-fawx-cheating-busty-wife','aj-applegate-nuru','never-done-nuru-before-alina-lopez','working-out-by-the-pool-abigail-morris','mia-malkova-massive-cock-husband-at-work','massage-nuru-nina-elle-fake-tits','lena-paul-gets-fucked-during-massage','chinese-av-bigtits','nuru-massage-sky-wonderland-how-rude','indian-couple-passionate-sex-desi-ansi-bhabhi','lena-paul-amazing-lady-massage-fuck','angela-white-pov-feature','that-s-not-a-water-bottle-that-s-my-fleshlight-she-can-t-stop-craving-his-cum-alicia-williams-arin-jones']) s
where not exists (select 1 from public.movies m where m.slug = s)
on conflict (slug) do nothing;
