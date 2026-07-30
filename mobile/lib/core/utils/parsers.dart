/// Money and rates travel as JSON strings ("1200.00") so no precision is lost in
/// transit. Screens need them back as numbers.
double asDouble(dynamic value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? 0;
  return 0;
}
