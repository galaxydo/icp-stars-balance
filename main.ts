import cors from 'https://deno.land/x/edge_cors/src/cors.ts'

// Define constants
const ROSETTA_URL = 'https://rosetta-api.internetcomputer.org';
const NET_ID = {
  blockchain: 'Internet Computer',
  network: '00000000000000020101',
};
const treasuryPrincipal = 'rluj7-udbu7-7ksiq-kcaw6-3hedq-itl47-td4yw-afwzq-v54ml-mgl3j-aqe';
const treasuryAccountId = '844378e512c634f617ca8d96977d4a9445ba5edbc01b8b28fd80791823f8c671';
const starsPerIcp = 7;

async function rosettaPost(endpoint: string, body: any) {
  const response = await fetch(`${ROSETTA_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Error: ${response.status} ${error.message}`);
  }

  return await response.json();
}

async function getICPTransactions(accountId: string) {
  const body = {
    network_identifier: NET_ID,
    account_identifier: {
      address: accountId,
    },
  };

  try {
    const { transactions, total_count } = await rosettaPost('/search/transactions', body);
    return {
      total: total_count,
      transactions,
    };
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return {
      total: 0,
      transactions: [],
    };
  }
}


Deno.serve( async (req: Request) => {
    const params = new URL(req.url).searchParams;
    const accountId = params.get('accountId');

    if (!accountId) throw 'should provide ?accountId='

    const transactionsResult = await getICPTransactions(accountId);
    let starsBalance = BigInt(0);

  let decimals = 8;

  transactionsResult.transactions.forEach((transaction) => {
    transaction = transaction.transaction
    const operations = transaction.operations || [];
    operations.forEach((operation) => {
      if (operation.type === 'TRANSACTION' &&
        operation.account.address === treasuryAccountId &&
        operation.amount.currency.symbol === 'ICP'
      ) {
        const amountBigInt = BigInt(operation.amount.value);
        starsBalance += amountBigInt;
        decimals = operation.amount.currency.decimals;
      }
    });
  });

  starsBalance *= BigInt(starsPerIcp);

  const factor = BigInt(10 ** decimals);

  const starsBalanceFixedPoint = Number(starsBalance / factor).toFixed(decimals);

  return cors(
    req,
    new Response(starsBalanceFixedPoint)
  );
});
