# Política de Privacitat

_Última actualització:_ Dissabte 4 de juliol de 2026

## 1. Responsable del tractament

- _Responsable:_ LSigner, S.L.
- _NIF:_ B12345678
- _Domicili:_ Carrer de Maria Aurèlia Capmany i Farnés, 67, 17006, Girona, Espanya
- _Correu electrònic de contacte (Delegat de Protecció de Dades / privacitat):_ info@lsigner.com

## 2. Dades que tractem

LSigner tracta les següents categories de dades personals, en funció de com l'Usuari interactua amb la Plataforma:

### 2.1 Dades de registre i compta

Nom, cognoms, correu electrònic, número de telèfon (si s'usa MFA per SMS), contrasenya (emmagatzemada mitjançant hash segur), i, en el cas de comptes empresarials (B2B), dades de l'empleat facilitats per l'empresa contractant (nom, email corporatiu, rol).

### 2.2 Dades d'autenticació i verificació

Registres d'accés (login), estat de verificació multifactor (MFA), i evidència de verificació OTP (canal utilitzat —correu electrònic—, marca temporal d'enviament i de validació). El codi OTP és generat i validat íntegrament pels sistemes propis de LSigner; el proveïdor de correu electrònic esmentat en la secció 4 es limita a transportar el missatge que conté aquest codi fins a la safata d'entrada de l'Usuari, sense intervenir en la seva generació, emmagatzematge o validació. El codi OTP en si _no es conserva_ una vegada utilitzat o expirat.

### 2.3 Dades del procés de signatura (evidències)

En el moment en què un Usuari signa un document, LSigner recull i conserva les següents evidències amb la finalitat de garantir la integritat, autenticitat i no repudi de la signatura:

- Adreça IP del dispositiu utilitzat.
- Data i hora exacta de la signatura (timestamp).
- Informació del dispositiu i navegador (user-\*agent).
- Identificador únic de l'operació de signatura.
- Hash criptogràfic del document abans i després de la signatura.
- Resultat del procés de verificació OTP associat a aquesta signatura concreta.
- Geolocalització aproximada derivada de l'adreça IP (a nivell de ciutat/regió, no de precisió GPS).

LSigner _no recull dades biomètriques_ de la signatura manuscrita (traç, pressió, velocitat), ja que el procés de signatura es realitza mitjançant verificació OTP i no mitjançant captura de signatura manuscrita digitalitzada.

### 2.4 Documents signats

El contingut dels documents que l'Usuari puja i signatura a través de la Plataforma. LSigner no controla ni modera el contingut d'aquests documents, que pot incloure dades personals de tercers introduïts pel propi Usuari (per exemple, si el document és un contracte amb dades d'una altra persona). En aquests casos, l'Usuari actua com a responsable d'aquest tractament i LSigner com a encarregat, en els termes descrits en el Contracte d'Encarregat de Tractament.

### 2.5 Dades tècniques i de navegació

Cookies i tecnologies similars, segons el descrit en la [Política de Cookies](/legal/cookie-*policy).

## 3. Finalitats del tractament

| Finalitat                                                                       | Base legal (RGPD)                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Gestió del registre i el compte d'Usuari                                        | Execució d'un contracte (art. 6.1.b)                                |
| Autenticació, MFA i verificació OTP                                             | Execució d'un contracte (art. 6.1.b)                                |
| Generació i conservació d'evidències de signatura                               | Execució d'un contracte (art. 6.1.b) i obligació legal (art. 6.1.c) |
| Conservació de documents signats                                                | Execució d'un contracte (art. 6.1.b)                                |
| Comunicacions de servei (notificacions sobre signatures, seguretat del compte)  | Execució d'un contracte (art. 6.1.b)                                |
| Comunicacions comercials (si l'Usuari el consent)                               | Consentiment (art. 6.1.a)                                           |
| Prevenció del frau i seguretat de la Plataforma                                 | Interès legítim (art. 6.1.f)                                        |
| Compliment d'obligacions legals (conservació mercantil, requeriments judicials) | Obligació legal (art. 6.1.c)                                        |

## 4. Destinataris i encarregats del tractament

LSigner pot compartir dades personals amb els següents tercers, en la seva condició d'encarregats del tractament, en la mesura necessària per a prestar el servei:

- _Proveïdor d'allotjament (hosting):_ Hostinger, amb infraestructura desplegada específicament en la seva ubicació a França (Unió Europea). Les dades de la base de dades PostgreSQL i les còpies de seguretat (emmagatzemats en un contenidor S3) resideixen en territori de la UE.
- _Proveïdor de desplegament/orquestració de contenidors:_ Dokploy, sobre la mateixa infraestructura anterior.
- _Proveïdor de lliurament de correu electrònic (SMTP):_ proveïdor amb seu al Regne Unit, encarregat de enrutar i lliurar els correus electrònics enviats des del domini de LSigner, inclosos els que contenen el codi OTP generat pels sistemes propis de LSigner. Aquest proveïdor actua com un mer transportista del missatge i no participa en la generació, emmagatzematge ni validació del codi OTP. Les transferències de dades a aquest proveïdor estan emparades per la Decisió d'Adequació de la Comissió Europea relativa al Regne Unit (renovada el 19 de desembre de 2025, vàlida fins a desembre de 2031), per la qual cosa no es requereixen garanties addicionals com a Clàusules Contractuals Tipus.
- _Empreses clients (en el cas d'ús B2B):_ quan un Usuari signa documents en el context d'una relació amb una empresa client de LSigner (per exemple, el seu ocupador), aquesta empresa pot tenir accés als documents i evidències de signatura relacionats amb aquesta relació, en la seva condició de responsable del tractament respecte als seus propis empleats o clients.
- _Autoritats públiques:_ quan existeixi una obligació legal o un requeriment judicial.

LSigner no ven ni cedeix dades personals a tercers amb finalitats publicitaris.

## 5. Transferències internacionals de dades

Com a norma general, les dades s'emmagatzemen i processen dins de la Unió Europea (infraestructura a França). L'única transferència fora de la UE és la relativa a l'encaminament i lliurament de correus electrònics (inclosos els que contenen el codi OTP) a través del proveïdor de correu amb seu al Regne Unit, país que compta amb Decisió d'Adequació vigent per part de la Comissió Europea, la qual cosa garanteix un nivell de protecció equivalent al de la UE sense necessitat de mecanismes addicionals de transferència. El codi OTP en si és generat, emmagatzemat i validat exclusivament en la infraestructura de LSigner a la UE; el proveïdor britànic únicament transporta el correu que el conté.

## 6. Terminis de conservació

- _Documents signats i evidències de signatura:_ es conserven durant _6 anys_ des de la data de la signatura, en línia amb el termini de conservació de documentació mercantil establert en l'article 30 del Codi de Comerç, amb la finalitat de preservar el seu valor probatori davant possibles reclamacions.
- _Dades del compte:_ mentre l'Usuari mantingui el seu compte actiu, i fins a 12 mesos addicionals després de la baixa, per si l'Usuari desitja reactivar-la o per a resoldre disputes pendents.
- _Codi OTP:_ de naturalesa efímera; s'elimina automàticament després del seu ús o expiració (en qüestió de minuts).
- \*_Logs tècnics i de seguretat no vinculats a una signatura concreta:_ fins a 12 mesos.

Transcorreguts aquests terminis, les dades s'eliminen o s'anonimitzen de manera irreversible, tret que existeixi una obligació legal que exigeixi la seva conservació addicional.

## 7. Drets dels Usuaris

De conformitat amb el RGPD i la LOPDGDD, l'Usuari pot exercir en qualsevol moment els següents drets, enviant una sol·licitud a privacidad@lsigner.com, adjuntant còpia d'un document identificatiu:

- _Accés:_ conèixer quines dades tractem sobre l'Usuari.
- _Rectificació:_ corregir dades inexactes.
- _Supressió:_ sol·licitar l'eliminació de les seves dades, tret que existeixi obligació legal de conservar-los (per exemple, evidències de signatura dins del termini de conservació mercantil).
- _Oposició:_ oposar-se al tractament basat en interès legítim.
- _Limitació del tractament:_ sol·licitar la limitació en determinats suposats.
- _Portabilitat:_ rebre les seves dades en un format estructurat i d'ús comú.
- _Retirar el consentiment_ en qualsevol moment, quan el tractament es basi en aquest.

L'Usuari té també dret a presentar una reclamació davant l'Agència Espanyola de Protecció de Dades (AEPD) si considera que els seus drets no han estat degudament atesos.

## 8. Seguretat de les dades

LSigner aplica mesures tècniques i organitzatives apropiades per a protegir les dades personals, incloent xifrat de contrasenyes mitjançant funcions de hash segures, autenticació multifactor, xifrat de comunicacions (HTTPS/TLS), còpies de seguretat periòdiques i control d'accessos a la infraestructura.

## 9. Menors d'edat

La Plataforma no està dirigida a menors de 18 anys. LSigner no recapta conscientment dades de menors. Si es detectés que un menor ha proporcionat dades sense el consentiment del seu tutor legal, aquests seran eliminats.

## 10. Canvis en aquesta Política

LSigner podrà modificar aquesta Política de Privacitat per a adaptar-la a canvis normatius o funcionals de la Plataforma. Qualsevol canvi rellevant serà comunicat als Usuaris registrats i es reflectirà actualitzant la data de "última actualització" a l'inici d'aquest document.
