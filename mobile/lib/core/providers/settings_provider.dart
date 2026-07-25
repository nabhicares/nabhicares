import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';

final settingsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final dio = ref.watch(dioClientPrv);
  final response = await dio.get('/settings');
  
  if (response.data != null && response.data['success'] == true) {
    return response.data['data'] as Map<String, dynamic>;
  }
  
  // Default fallback if database is not seeded or returns error
  return {
    'hospitalName': 'Pharma Store General Hospital',
    'taxPercentage': 18,
    'lowStockThreshold': 15,
  };
});
