// Mobile QR 스캐너 — expo-camera native (MLKit on Android, AVFoundation on iOS).
// Web jsQR보다 어두운 환경에서 훨씬 정확.
// QR 내용: https://aircondemocracy.com/p/{placeId}?via=qr 형식 예상.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN } from '@aircon/core';

export default function QRScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.msg}>준비 중…</Text></View></SafeAreaView>;
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.msg}>QR 스캔에 카메라 권한이 필요해요.</Text>
          <Pressable onPress={requestPermission} style={styles.btn}><Text style={styles.btnText}>권한 허용</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.safe}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }: BarcodeScanningResult) => {
          if (scanned) return;
          setScanned(true);
          // URL 형식: https://aircondemocracy.com/p/{placeId}?via=qr 또는 단순 placeId
          try {
            const url = new URL(data);
            const m = url.pathname.match(/^\/p\/(.+?)\/?$/);
            if (m) {
              router.push(`/p/${m[1]}`);
              return;
            }
          } catch {
            // 단순 문자열 — placeId로 가정
          }
          router.push(`/p/${encodeURIComponent(data)}`);
        }}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.guide}>
          <Text style={styles.guideText}>QR 코드를 화면 안에 맞춰주세요</Text>
        </View>
        {scanned && (
          <Pressable onPress={() => setScanned(false)} style={styles.rescan}>
            <Text style={styles.rescanText}>다시 스캔</Text>
          </Pressable>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: TOKEN.bg },
  msg: { fontSize: 14, color: TOKEN.text1, marginBottom: 16, textAlign: 'center' },
  btn: { padding: 14, paddingHorizontal: 32, backgroundColor: TOKEN.cold, borderRadius: TOKEN.r.md },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'flex-end', padding: 24 },
  guide: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' },
  guideText: { color: '#fff', fontSize: 13, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 8 },
  rescan: { padding: 14, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: TOKEN.r.lg, alignItems: 'center' },
  rescanText: { fontSize: 14, fontWeight: '700', color: TOKEN.text1 },
});
