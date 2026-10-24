# Conectar las publicaciones de Instagram

## Estado

El código del feed está preparado. La cuenta todavía necesita autorización y `dist/instagram.json` conserva `feedUrl` vacío. Mientras tanto, la portada presenta las cinco fotografías locales con el mismo carrusel.

## Conexión

1. Abre una cuenta en [Behold](https://app.behold.so/) y revisa sus [planes y límites actuales](https://behold.so/pricing/).
2. En **Sources**, añade una **Basic source**. Si otra persona administra Instagram, copia el enlace de autorización que aparece en el panel y compártelo con ella. Esa persona autoriza la cuenta directamente con Instagram y no necesita iniciar sesión en Behold.
3. La cuenta debe ser de tipo **Business** o **Creator**. Después de la autorización, crea un feed de tipo **JSON** para `@cataniacocteleria` con hasta cinco publicaciones para esta portada.
4. En la lista de dominios permitidos, añade el dominio exacto donde publiques la web. El dominio de la versión actual es `catania-bebidas-artesanales-juann.a22733321.chatgpt.site`.
5. Copia la URL pública del feed y escríbela en la propiedad `feedUrl` de `dist/instagram.json`.

La configuración tiene esta estructura; sustituye el texto de ejemplo por la URL real antes de publicar:

```json
{
  "provider": "behold",
  "feedUrl": "https://feeds.behold.so/IDENTIFICADOR_REAL",
  "expectedUsername": "cataniacocteleria",
  "limit": 5,
  "refreshMinutes": 60
}
```

La URL de lectura del feed está diseñada para ser pública. No introduzcas contraseñas ni tokens de Instagram en este archivo.

## Verificación después de autorizar

- Comprueba que el feed pertenece a la cuenta esperada y devuelve publicaciones válidas.
- Revisa que las imágenes cargan en el dominio de producción y mantienen su encuadre.
- Confirma el enlace de la publicación actual, el avance manual, la pausa y el comportamiento móvil.
- Publica los archivos actualizados. Las publicaciones posteriores se recibirán a través del feed sin editar las fotografías del HTML.

La frecuencia de sincronización y los límites de solicitudes dependen del plan del proveedor. El intervalo `refreshMinutes` controla la revisión del navegador, no la velocidad a la que Behold obtiene publicaciones nuevas. Un cambio de contraseña o de privacidad de Instagram puede exigir una nueva autorización.

## Referencias

- [Formato del feed JSON](https://behold.so/docs/json-feeds/).
- [Fuentes y autorización por el administrador](https://behold.so/docs/basic-vs-advanced-sources/).
