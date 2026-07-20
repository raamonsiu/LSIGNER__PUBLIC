# Privacy Policy

**Last updated:** Saturday, July 4, 2026

## 1. Data controller

- **Responsible:** LSigner, S.L. - **NIF:** B12345678
- **Address:** Carrer de Maria Aurèlia Capmany i Farnés, 67, 17006, Girona, Spain
- **Contact email (Data Protection Officer / privacy):** info@lsigner.com

## 2. Data we handle

LSigner processes the following categories of personal data, depending on how the User interacts with the Platform:

### 2.1 Registration and Account Data

First name, last name, email address, phone number (if MFA via SMS is used), password (stored using a secure hash), and, in the case of business accounts (B2B), employe data provided by the contracting company (name, corporate email, role).

### 2.2 Authentication and Verification Data

Access logs (login), multi-factor verification status (MFA), and OTP verification evidence (channel used —email—, timestamp of sending and validation). The OTP code is generated and validated entirely by LSigner’s own systems; the email provider mentioned in section 4 is limited to transporting the message containing said code to the User's inbox, without intervening in its generation, storage, or validation. The OTP code itself **is not retained** once used or expired.

### 2.3 Signature Process Data (evidence)

At the moment a User signs a document, LSigner collects and retains the following evidence in order to ensure the integrity, authenticity, and non-repudiation of the signature:

- IP address of the device used.
- Exact date and time of the signature (timestamp).
- Device and browser information (user-agent).
- Unique identifier of the signing operation.
- Cryptographic hash of the document before and after the signature.
- Result of the OTP verification process associated with that specific signature.
- Approximate geolocation derived from the IP address (at the city/region level, not GPS precision).

LSigner **does not collect biometric data** from the handwritten signature (stroke, pressure, speed), as the signing process is carried out thru OTP verification and not thru the capture of a digitized handwritten signature.

### 2.4 Signed Documents

The content of the documents that the User uploads and signs thru the Platform. LSigner does not control or moderate the content of these documents, which may include personal data of third parties entered by the User themselves (for example, if the document is a contract with another person's data). In these cases, the User acts as the data controller and LSigner as the data processor, under the terms described in the Data Processing Agreement.

### 2.5 Technical and Navigation Data

Cookies and similar technologies, as described in the [Cookie Policy](/legal/cookie-policy).

## 3. Purposes of the processing

| Purpose                                                                            | Legal basis (GDPR)                                                     |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| User registration and account management                                           | Execution of a contract (art. 6.1.b)                                   |
| Authentication, MFA, and OTP verification                                          | Execution of a contract (art. 6.1.b)                                   |
| Generation and preservation of signature evidence                                  | Execution of a contract (art. 6.1.b) and legal obligation (art. 6.1.c) |
| Preservation of signed documents                                                   | Execution of a contract (art. 6.1.b)                                   |
| Service communications (notifications about signatures, account security)          | Execution of a contract (art. 6.1.b)                                   |
| Commercial communications (if the User consents)                                   | Consent (art. 6.1.a)                                                   |
| Prevention of fraud and platform security                                          | Legitimate interest (art. 6.1.f)                                       |
| Compliance with legal obligations (commercial preservation, judicial requirements) | Legal obligation (art. 6.1.c)                                          |

## 4. Recipients and data processors

LSigner may share personal data with the following third parties, in their capacity as data processors, to the extent necessary to provide the service:

- **Hosting provider:** Hostinger, with infrastructure deployed specifically at its location in France (European Union). The PostgreSQL database data and backups (stored in an S3 container) reside within the EU territory.
- **Container deployment/orchestration provider:** Dokploy, on the same previous infrastructure.
- **Email delivery provider (SMTP):** UK-based provider responsible for routing and delivering emails sent from the LSigner domain, including those containing the OTP code generated by LSigner’s own systems. This provider acts merely as a transfer and does not validate the OTP code. Data transfers to this provider are covered by the European Commission's Adequacy Decision regarding the United Kingdom (renewed on December 19, 2025, valid until December 2031), so they are not re-registered and will be reflected by updating the "last updated" date at the beginning of this document.
