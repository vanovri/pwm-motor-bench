PWM Motor Bench
===============

Buka index.html di browser untuk menjalankan simulasi offline.
Untuk membangun ulang dengan Node.js 20.10+, jalankan node build.mjs --audit.
Tambahkan --light untuk membuat index-light.html.

Bongkar motor menampilkan stator, rotor dengan komutator, dan kipas
pada satu sumbu. Pilih bagian pada gambar atau dengan tombol di bawahnya.
Tampilan ini memakai susunan ilustratif motor DC bersikat.

Aktifkan Tahan RPM dan coba Beban 0%, 65%, lalu 100% pada setpoint
1.800 RPM. Pada 65%, kontrol menaikkan duty dari sekitar 50% ke 95,5%.
Pada 100%, duty mentok 100% dan motor stabil di sekitar 1.500 RPM.
Tombol Putus PWM menonaktifkan kontrol kecepatan dan menurunkan duty ke nol.

Duel Dyno
---------
Dua motor identik mulai pada 1.800 RPM. Motor pertama memakai duty 50%.
Motor kedua memakai kontrol PI dengan target 1.800 RPM. Beban 65% atau
100% masuk pada detik 2 dan lepas pada detik 6. Uji selesai di detik 10.
Simulasi memakai langkah waktu 25 ms. Skor menghitung rata-rata selisih
absolut RPM terhadap 1.800 selama seluruh uji. Nilai yang lebih kecil
berarti putaran lebih dekat ke target.

Pit Tuning membandingkan PI bawaan dengan profil Redam lonjakan,
Pulih cepat, atau setelan Gain P dan Gain I dari slider. Grafik
menambahkan garis PI bawaan. Metrik Pulih ke ±2% dihitung sejak beban
lepas sampai kecepatan masuk dan bertahan dalam rentang tersebut hingga
akhir uji. Ekspor CSV menyimpan 401 sampel dan gain aktif. Duty dan
beban pada setiap baris berlaku untuk interval sebelum waktu baris.

Meja uji
--------
Fader mengubah tegangan rata-rata motor. Osiloskop menunjukkan dua periode.
Kipas bergerak mengikuti RPM yang sama dengan tachometer. Beban menambah
hambatan rotasi yang sebanding dengan RPM. Diagram memakai 1 kHz, level
LOW 0 V, dan level HIGH 12 V. Animasi putaran diperlambat 18 kali.

Model motor
-----------
Model orde satu mengabaikan induktansi, riak arus, dan rugi driver. Angka
3.600 RPM tanpa beban pada duty 100%, konstanta waktu 0,62 s, dan faktor
beban 1,4 merupakan parameter ilustrasi.

Tahan RPM memakai kontrol PI dengan koreksi integral saat duty mencapai
batas 0% atau 100%. Model menghitung duty dengan resolusi 0,1%.

Bagian
------
Meja: alas, empat sepatu dan dudukan, pelat, dan rak modul.
Osiloskop: kaki, sasis, tutup, bezel, tombol, ventilasi, dan layar.
Motor: dudukan, rumah, sambungan, sirip, penutup, pelat baut, impeller,
poros dan hub. Fader: rumah, rel, penahan, skala, gagang dan rusuk.

Rujukan
-------
Kit SVG Anatomy (MIT), commit 1482e8469b0a9e0d8cc18ea2740a01423d29ae80.
https://github.com/wheresryan22/anatomy
MIT 6.302, model motor DC dengan masukan PWM.
https://introcontrol.mit.edu/fall21/prelabs/prelab10/model
IIT Kharagpur, pendekatan motor DC orde satu.
https://vlabs.iitkgp.ac.in/ctrl/Exp3/theory.html
Microchip AN905, bagian dan prinsip motor DC bersikat.
https://ww1.microchip.com/downloads/en/Appnotes/00905B.pdf
MathWorks, pembatasan integral pada kontrol PID.
https://www.mathworks.com/help/simulink/slref/anti-windup-control-using-a-pid-controller.html
