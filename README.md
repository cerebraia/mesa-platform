# Mejora visual de la one page de Mesa

Este paquete contiene el hero original generado en morado, Poppins con cuatro pesos y licencia, y una implementación de referencia integrada en la base inicial de Mesa.

Extrae el paquete en una carpeta separada dentro del proyecto, por ejemplo visual-update/. Pide a Claude Code que adapte los cambios a tu versión actual. No reemplaces a ciegas el proyecto completo: tu copia ya contiene migraciones y cambios posteriores.

- assets/images/mesa-hero.png: colocar en public/images/mesa-hero.png.
- assets/fonts/: colocar en src/app/fonts/.
- referencia/page.tsx, layout.tsx y globals.css: referencia de integración, no reemplazo automático.

La integración utiliza next/image y next/font/local. No requiere instalar dependencias adicionales ni acceder a Google Fonts durante la compilación. El arte muestra un concepto de interfaz, no una captura de funciones reales. Nombre Mesa provisional.

La referencia integrada compila con Next.js. No se hizo revisión visual en navegador.
