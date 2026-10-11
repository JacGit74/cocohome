# Costco daily catalog

Runs ordinary Node.js scripts, without AI, daily at 08:17 Asia/Seoul (23:17 UTC). GitHub scheduling may be delayed.

Sources: official SpecialPriceOffers, whatsnew, and the configured FY27_P2W2_MemberAppreciation campaign. New campaign-specific category codes require maintenance; primary special-offer and new-product categories remain stable. Warehouse reports, flyers and closure calendars are not updated by this job.

All pages and unique product counts must validate, and normalization must succeed, before a single commit publishes output/snapshot.json and data/catalog.json. Failures leave the previous committed snapshot intact. The existing website reads data/catalog.json and shows its collection timestamp. Its browser cache provides a last-success fallback.

Run manually from Actions → Costco daily refresh → Run workflow. Review failed runs before changing source parsing. No AI credentials or services are used. Repository is public and only public product data and collection scripts are stored here.
