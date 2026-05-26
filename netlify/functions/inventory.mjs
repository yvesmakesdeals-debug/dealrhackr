export default async (req) => {
  const key = Netlify.env.get("MARKETCHECK_KEY");

  if (!key) {
    return Response.json(
      { error: "MARKETCHECK_KEY not set. Add it in Netlify → Environment variables." },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  const params = new URLSearchParams(url.search);
  params.set("api_key", key);

  const mcUrl = `https://api.marketcheck.com/v2/search/car/active?${params}`;

  try {
    const res = await fetch(mcUrl);
    const data = await res.json();

    if (!res.ok) {
      return Response.json({ error: data }, { status: res.status });
    }

    const listings = (data.listings || []).map((l) => {
      if (l.media?.photo_links_cached) delete l.media.photo_links_cached;
      return l;
    });

    return Response.json({
      listings,
      totalCount: data.num_found || 0,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};
