// TEMPORARY DIAGNOSTIC — reports what the deployed function actually reads for
// Midtrans config. Masked: only prefixes/booleans, never full secrets.
// DELETE this file once the production payment flow is verified.
module.exports = async (req, res) => {
  const raw = process.env.MIDTRANS_IS_PRODUCTION;
  const sk = process.env.MIDTRANS_SERVER_KEY || '';
  const ck = process.env.MIDTRANS_CLIENT_KEY || '';
  res.status(200).json({
    isProductionRaw: JSON.stringify(raw),            // e.g. "\"true\"", "\"false\"", "\"true \"", undefined
    isProductionResolved: raw === 'true',            // what the SDK actually gets
    serverKeyPrefix: sk.slice(0, 11),                // "Mid-server-" or "SB-Mid-serv"
    serverKeyIsProd: sk.startsWith('Mid-server-'),
    serverKeyLen: sk.length,
    clientKeyPrefix: ck.slice(0, 11),
    clientKeyIsProd: ck.startsWith('Mid-client-'),
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
};
