-- 用户可选择需要展示的账单维度;已有用户和新用户默认显示全部三个维度
ALTER TABLE "User"
ADD COLUMN "ledgerEntrySources" "LedgerRecordSource"[] NOT NULL
DEFAULT ARRAY['manual_day', 'manual_week', 'manual_month']::"LedgerRecordSource"[];
