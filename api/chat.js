export default async function handler(req, res) {
  // CORS — autorise GitHub Pages à appeler ce backend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { question, products, mode } = req.body;

    if (!question) return res.status(400).json({ error: 'Question manquante' });

    // Construire le résumé des produits candidats
    const productList = (products || []).slice(0, 12).map(p =>
      `• Réf ${p.r} — ${p.n}${p.u ? ' | ' + p.u.split('|')[0].trim() : ''}${p.p ? ' | Poids max : ' + p.p : ''}${p.d ? ' | Dim : ' + p.d : ''}${p.ttc ? ' | Prix TTC : ' + p.ttc + ' €' : ''}${p.ht ? ' | HT : ' + p.ht + ' €' : ''}${p.desc ? '\n  ' + p.desc.slice(0, 120) : ''}`
    ).join('\n');

    const isCommercial = mode === 'commercial';

    const systemPrompt = `Tu es le conseiller produits de la société Identités, spécialisée dans les aides techniques et le bien-être (aides à la mobilité, accessoires salle de bain, équipements médicaux).

Ton rôle : analyser la question de l'utilisateur, identifier les produits les plus adaptés parmi les candidats fournis, et répondre de façon claire, simple et bienveillante.

Règles :
- Recommande 1 à 4 produits maximum, en expliquant brièvement pourquoi chacun répond au besoin
- Si aucun produit ne correspond vraiment, dis-le honnêtement et demande des précisions
- Pose une question de qualification si tu manques d'informations importantes (poids, dimensions, contexte)
- ${isCommercial ? 'Mode commercial : tu peux mentionner les tarifs HT, TTC et paliers quantitatifs' : 'Mode particulier : mentionne uniquement le prix TTC public, jamais les tarifs HT ni les remises'}
- Réponds TOUJOURS en français
- Sois concis (5-8 lignes max)`;

    const userMessage = productList
      ? `Question : ${question}\n\nProduits candidats pré-sélectionnés :\n${productList}`
      : `Question : ${question}\n\n(Aucun produit candidat trouvé — demande des précisions à l'utilisateur)`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Anthropic API error:', err);
      return res.status(500).json({ error: 'Erreur API Claude', detail: err });
    }

    const data = await response.json();
    return res.json({ answer: data.content[0].text });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
  }
}
