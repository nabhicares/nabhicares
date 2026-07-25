enum StockStatus {
  ok('OK'),
  low('Low'),
  out('Out');

  final String label;
  const StockStatus(this.label);

  static StockStatus of({required int totalQuantity, required int reorderLevel}) {
    if (totalQuantity <= 0) return StockStatus.out;
    if (totalQuantity <= reorderLevel) return StockStatus.low;
    return StockStatus.ok;
  }
}
