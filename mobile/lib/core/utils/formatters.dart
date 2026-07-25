const _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/// "1234567" -> "12,34,567" (Indian grouping, matching the GST/₹ context).
String formatNumber(num value) {
  final isNegative = value < 0;
  final digits = value.abs().toStringAsFixed(0);
  if (digits.length <= 3) return isNegative ? '-$digits' : digits;

  final last3 = digits.substring(digits.length - 3);
  var rest = digits.substring(0, digits.length - 3);
  final groups = <String>[];
  while (rest.length > 2) {
    groups.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) groups.insert(0, rest);

  final formatted = '${groups.join(',')},$last3';
  return isNegative ? '-$formatted' : formatted;
}

String formatCurrency(num value) {
  final whole = value.truncate();
  final paise = ((value - whole).abs() * 100).round().toString().padLeft(2, '0');
  return '₹${formatNumber(whole)}.$paise';
}

/// ISO date (YYYY-MM-DD) -> "Oct 2028". Falls back to the raw string.
String formatMonthYear(String isoDate) {
  final parsed = DateTime.tryParse(isoDate);
  if (parsed == null) return isoDate;
  return '${_months[parsed.month - 1]} ${parsed.year}';
}

/// ISO date -> "12 Oct 2028".
String formatDate(String isoDate) {
  final parsed = DateTime.tryParse(isoDate);
  if (parsed == null) return isoDate;
  return '${parsed.day} ${_months[parsed.month - 1]} ${parsed.year}';
}

/// ISO timestamp -> "12 Oct 2028, 14:05".
String formatDateTime(String isoTimestamp) {
  final parsed = DateTime.tryParse(isoTimestamp);
  if (parsed == null) return isoTimestamp;
  final local = parsed.toLocal();
  final hh = local.hour.toString().padLeft(2, '0');
  final mm = local.minute.toString().padLeft(2, '0');
  return '${formatDate(local.toIso8601String())}, $hh:$mm';
}

/// Human phrasing for an expiry countdown.
String expiryLabel(int? daysToExpiry) {
  if (daysToExpiry == null) return 'No expiry date';
  if (daysToExpiry < 0) return 'Expired ${-daysToExpiry}d ago';
  if (daysToExpiry == 0) return 'Expires today';
  return 'Expires in $daysToExpiry days';
}

/// YYYY-MM-DD, the format the backend DTOs expect.
String toApiDate(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
}
