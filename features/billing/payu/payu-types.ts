export type PayuEnvironment = "test" | "live";

export type PayuConfig = {
  merchantKey: string;
  merchantSalt: string;
  authHeader: string;
  environment: PayuEnvironment;
  isTestMode: boolean;
};

export type PayuOrderResponse = {
  status: number;
  body: {
    result: Array<{
      paymentId: string;
      amount: string;
      productinfo: string;
      firstname: string;
      email: string;
      phone: string;
      surl: string;
      furl: string;
      hash: string;
      txnid: string;
      key: string;
      service_provider: string;
      user_credentials: string;
      field1: string;
      field2: string;
      field3: string;
      field4: string;
      field5: string;
      udf1: string;
      udf2: string;
      udf3: string;
      udf4: string;
      udf5: string;
    }>;
  };
};

export type PayuVerifyResponse = {
  status: number;
  msg: string;
  transaction_details: Record<string, PayuTransactionDetail>;
};

export type PayuTransactionDetail = {
  mihpayid: string;
  request_id: string | null;
  bank_ref_num: string | null;
  amt: string;
  txnsource: string;
  addedon: string;
  discount: string;
  net_amount_debit: string;
  additional_charges: string;
  card_type: string | null;
  error_code: string | null;
  error_Message: string | null;
  name_on_card: string | null;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  udf6: string;
  udf7: string;
  udf8: string;
  udf9: string;
  udf10: string;
  merchant_utr: string | null;
  payee_type: string | null;
  status: string;
  txnid: string;
  unmappedstatus: string;
  mode: string;
  pg_type: string;
  bank_name: string;
  payuMoneyId: string;
  refund_status: string | null;
  settle_amount: string | null;
  settle_id: string | null;
  settle_time: string | null;
};

export type PayuRefundResponse = {
  status: number;
  msg: string;
  refund_details: {
    refund_id: string;
    refund_amount: string;
    refund_status: string;
    error_code: string;
    error_msg: string;
    total_refund_amount: string;
  };
};

export type PayuWebhookPayload = {
  mihpayid: string;
  mode: string;
  status: string;
  unmappedstatus: string;
  key: string;
  txnid: string;
  amount: string;
  discount: string;
  net_amount_debit: string;
  addedon: string;
  productinfo: string;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  hash: string;
  field1: string;
  field2: string;
  field3: string;
  field4: string;
  field5: string;
  bank_ref_num: string | null;
  bankcode: string;
  card_type: string | null;
  error_code: string | null;
  error_Message: string | null;
  name_on_card: string | null;
  payuMoneyId: string;
  merchant_utr: string | null;
  pg_type: string;
  settlement_id: string | null;
  additional_charges: string;
};

export type PayuHealthStatus = {
  configured: boolean;
  environment: PayuEnvironment | null;
  hasMerchantKey: boolean;
  hasMerchantSalt: boolean;
  hasWebhookHash: boolean;
};
