# Política de Signatura Electrònica

_Última actualització:_ Dissabte 4 de juliol de 2026

## 1. Objecte

Aquest document descriu el funcionament tècnic i legal del servei de signatura electrònica prestat per LSigner, en compliment del deure de transparència enfront dels Usuaris i enfront de tercers que puguin necessitar verificar la validesa d'un document signat a través de la Plataforma. Complementa als [Termes i Condicions](/legal/terms-*and-*conditions) i a la [Política de Privacitat](/legal/privacy-*policy).

## 2. Classificació legal de la signatura

De conformitat amb el Reglament (UE) núm. 910/2014 (eIDAS), existeixen tres nivells de signatura electrònica: Simple (SES), Avançada (AES) i Qualificada (QES).

La signatura generada per LSigner es classifica, a la data d'aquest document, com a \*Signatura Electrònica Simple (SES)\*\*, conforme a l'article 3.10 de eIDAS, ja que les dades de creació de signatura (clau criptogràfica) són gestionats de forma centralitzada per LSigner i no estan, encara, vinculats de manera exclusiva i individual a cada signant mitjançant una clau pròpia i exclusiva.

No obstant això, es tracta d'una \*_SES reforçada_: el procés incorpora múltiples garanties tècniques —autenticació multifactor, verificació OTP, evidencia forense detallada i signatura criptogràfica verificable— que excedeixen àmpliament l'exigit per a una signatura electrònica simple ordinària (com un simple clic o casella de selecció), aportant un nivell de traçabilitat i solidesa probatòria comparable, en la pràctica, al de sistemes més avançats, si bé sense la presumpció legal reforçada que atorga eIDAS a les signatures AES i QES.

Conforme a l'article 25.1 de eIDAS, no es podran negar efectes jurídics ni admissibilitat com a prova en procediments judicials a una signatura electrònica pel mer fet de ser simple. El seu valor probatori final es valorarà conforme a les regles generals de la prova electrònica, atenent precisament la robustesa de les evidències descrites en aquest document.

LSigner té previst evolucionar cap a un model de clau individual per Usuari amb capacitat de rotació, la qual cosa permetria, en el futur, reclassificar el servei com a Signatura Electrònica Avançada (AES), sempre que es compleixin a més la resta de requisits de l'article 26 de eIDAS. Qualsevol canvi en aquesta classificació serà comunicat als Usuaris mitjançant l'actualització d'aquest document.

## 3. Descripció del procés de signatura

1. _Autenticació:_ l'Usuari inicia sessió mitjançant credencials pròpies i un segon factor d'autenticació (MFA).
2. _Obertura del document:_ en obrir el document a signar, el sistema registra un esdeveniment d'accés (veure secció 4.1), amb independència de si l'Usuari decideix finalment signar, rebutjar o abandonar el procés.
3. _Verificació OTP:_ abans d'aplicar la signatura, LSigner genera un codi d'un sol ús (OTP) i l'envia al canal de contacte verificat de l'Usuari (correu electrònic). L'Usuari ha d'introduir aquest codi per a continuar. El OTP és generat, gestionat i validat íntegrament pels sistemes de LSigner.
4. _Aplicació de la signatura:_ una vegada verificat el OTP, el backend de LSigner aplica una signatura criptogràfica sobre una representació canònica de l'operació (veure secció 4.3) i genera el document PDF signat.
5. _Registre d'evidències:_ s'emmagatzema de manera immutable el conjunt d'evidències contextuals i criptogràfiques descrit en la secció 4.

## 4. Evidències registrades

### 4.1 Esdeveniment d'accés al document (`ACCESS_*OPENED`)

Amb independència que el document arribi a signar-se, cada obertura del document per part del destinatari genera un registre amb:

| Camp                  | Descripció                                                    |
| --------------------- | ------------------------------------------------------------- |
| `ip`                  | Adreça IP del signant en el moment de l'accés                 |
| `user_*agent`         | Navegador i sistema operatiu utilitzats                       |
| `is_*first_*access`   | Indica si és el primer accés al document o un accés posterior |
| `first_*accessed_*at` | Marca temporal del primer accés                               |
| `last_*accessed_*at`  | Marca temporal de l'accés més recent                          |

### 4.2 Evidència contextual de la signatura

En el moment de signar, rebutjar o revocar, es genera un artefacte (`DocumentSignedArtifact`) que inclou la següent evidència contextual:

| Camp                      | Descripció                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `verification_*method`    | Mètode de verificació emprat (`"OTP"`)                                                               |
| `verification_*reference` | Referència emmascarada del canal on es va enviar el OTP (email o un altre canal parcialment ocultat) |
| `recipient_email`         | Correu electrònic del signant                                                                        |
| `recipient_*name`         | Nom del signant                                                                                      |
| `ip`                      | Adreça IP des de la qual es va realitzar l'acció                                                     |
| `user_*agent`             | Navegador i sistema operatiu utilitzats                                                              |
| `signed_*at`              | Marca temporal exacta (format ISO 8601) de l'acció                                                   |
| `acaroni_type`            | Tipus d'arxiu del document                                                                           |
| `original_filename`       | Nom original del fitxer                                                                              |
| `reason`                  | (Només en rebuig/revocació) motiu proporcionat voluntàriament per l'Usuari                           |
| `state`                   | Estat de l'operació: `SIGNED`, `REJECTED` o `REVOKED`                                                |

### 4.3 Evidència criptogràfica

Per a garantir la integritat i el no repudi de cada signatura, LSigner genera i emmagatzema:

| Camp                      | Descripció                                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `signature`               | Signatura digital Ed25519 (codificada en base64) sobre el payload canònic de l'operació                                                                                                          |
| `signature_*algorithm`    | Algorisme emprat (`"Ed25519"`)                                                                                                                                                                   |
| `key_*fingerprint`        | Petjada SHA-256 de la clau pública Ed25519 empleada, que identifica de manera única la clau sense revelar-la                                                                                     |
| `key_*version`            | Versió de la clau utilitzada, per a permetre la rotació de claus mantenint la traçabilitat històrica                                                                                             |
| `public_*key_*hex`        | Clau pública en format hexadecimal, inclosa al costat de l'evidència perquè la signatura pugui verificar-se de manera autònoma en el futur, sense dependre del fet que LSigner continuï operatiu |
| `canonical_payload`       | Representació JSON determinista de les dades signades (veure secció 4.4)                                                                                                                         |
| `file_*hash`              | Petjada SHA-256 del binari del document signat, que permet detectar qualsevol alteració posterior                                                                                                |
| `previous_*artifact_aneu` | Identificador de l'artefacte d'evidència anterior relatiu al mateix document, si existís, formant una cadena de custòdia verificable en cas de re-signes o signatures successives                |

**Ed25519** és un algorisme de signatura digital de corba el·líptica àmpliament utilitzat per la seva seguretat i eficiència, que garanteix que només qui posseeixi la clau privada corresponent va poder generar una signatura vàlida verificable amb la clau pública associada.

### 4.4 Payload canònic signat

La signatura criptogràfica no s'aplica directament sobre el PDF, sinó sobre una representació JSON determinista ("canònica") de les dades rellevants de l'operació, la qual cosa garanteix que qualsevol verificador obtingui sempre el mateix resultat en recomputar la signatura. La seva estructura és:

```json
{
  "actor_aneu": "<UUID del firmante>",
  "actor_type": "RECIPIENT",
  "document_aneu": "<UUID del documento>",
  "file_*hash": "<SHA-256 del documento>",
  "key_*version": 1,
  "previous_*artifact_aneu": null,
  "recipient_aneu": "<UUID del firmante>",
  "state": "SIGNED",
  "timestamp": "2026-07-04T10:00:00Z"
}
```

### 4.5 Traçabilitat i cadena de custòdia

Cada artefacte d'evidència pot referenciar a l'artefacte immediatament anterior relatiu al mateix document (`previous_*artifact_aneu`), formant una cadena verificable que permet reconstruir l'històric complet d'accessos, signatures, rebutjos o revocacions d'un document, incloent-hi la detecció de qualsevol alteració en el `file_*hash` entre esdeveniments.

## 5. Rebuig i revocació

Un Usuari pot rebutjar o revocar una sol·licitud de signatura. En tots dos casos, es genera un artefacte d'evidència amb els mateixos camps contextuals descrits en la secció 4.2, incloent-hi l'estat corresponent (`REJECTED` o `REVOKED`) i, si l'Usuari el proporciona voluntàriament, un motiu (`reason`).

## 6. Verificació independent d'una signatura

Atès que la clau pública (`public_*key_*hex`) s'emmagatzema juntament amb cada evidència, qualsevol tercer (per exemple, un perit judicial o una de les parts en un litigi) pot verificar de manera independent, sense dependre dels sistemes de LSigner, que:

- La signatura (`signature`) correspon efectivament al `canonical_payload` emmagatzemat.
- El document no ha estat alterat des de la seva signatura, comparant el `file_*hash` emmagatzemat amb el hash recalculat del PDF.

Això reforça el valor probatori del sistema, ja que la verificació no depèn exclusivament de la paraula de LSigner, sinó d'una comprovació criptogràfica objectiva i reproduïble.

## 7. Conservació de les evidències

Les evidències descrites en aquest document es conserven conforme als terminis establerts en la [Política de Conservació i Custòdia Documental](/legal/data-retention-*policy), actualment fixats en 6 anys des de la data de la signatura.

## 8. Limitacions actuals del sistema

En favor de la transparència, LSigner informa de les següents limitacions del sistema a la data d'aquest document:

- La clau criptogràfica emprada per a signar (`key_*fingerprint`/`*key_*version`) és actualment _compartida a nivell de sistema_, no individual per Usuari. Això és el que determina la classificació com SES i no com AES (veure secció 2).
- El servei no captura dades biomètriques de signatura manuscrita (traç, pressió, velocitat), ja que la verificació d'identitat es realitza mitjançant OTP i no mitjançant signatura manuscrita digitalitzada.
- El sistema no constitueix, a la data d'aquest document, un servei de signatura electrònica qualificada (QES), per la qual cosa no aplica la presumpció reforçada de fiabilitat associada a aquest nivell superior.

## 9. Canvis en aquesta Política

LSigner podrà actualitzar aquesta Política de Signatura Electrònica per a reflectir canvis tècnics rellevants (per exemple, la implementació de claus individuals per Usuari) o canvis normatius. Qualsevol canvi rellevant es reflectirà actualitzant la data de "última actualització" a l'inici d'aquest document.
