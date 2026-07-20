# Document Conservation and Custody Policy

**Last updated:** Saturday, July 4, 2026

## 1. Object

This document details how long LSigner retains each category of data and information related to the use of the Platform, with what integrity guaranties, and what happens once these periods have elapsed. It complements the [Privacy Policy](/legal/privacy-policy) and the [Electronic Signature Policy](/legal/electronic-signature-policy).

## 2. Signed documents and signature evidence

The signed documents, along with all the evidence described in the Electronic Signature Policy (contextual evidence, cryptographic evidence, and canonical payload), are retained for **6 years** from the date of the corresponding signature, rejection, or revocation.

This period is set with reference to Article 30 of the Commercial Code, relating to the obligation to preserve commercial documentation, in order to preserve the evidentiary value of the signature for a reasonable period during which a claim related to the signed document could be made.

During this period, LSigner guaranties the integrity of documents and evidence thru the cryptographic mechanisms described in the Electronic Signature Policy (document hash, verifiable Ed25519 signature, chain of custody using `previous_artifact_id`), so that any subsequent alteration is detectable.

## 3. Document access events

Document access events (`ACCESS_OPENED`) are part of the chain of evidence for a signing operation and are retained for the same period as the document and the signing evidence to which they are associated (6 years), as they provide relevant context about when and from where the document was accessed before its signing, rejection, or revocation.

## 4. User account data

The data associated with a User's account (name, email, settings, activity history not directly linked to a specific signature) is retained while the account remains active, and for **12 additional months** after the account is deactivated or canceled, in order to allow for possible reactivation and to resolve any pending disputes related to the service.

After the 12-month period without reactivation, the account data is deleted or anonymized, without prejudice to the fact that the documents and signature evidence generated during the account's lifetime are retained for the period indicated in section 2, given their independent probative value.

## 5. OTP verification code

The OTP code generated for each verification operation has a strictly ephemeral nature: it is automatically deleted after its successful validation or after its expiration (within minutes from its generation). LSigner does not retain the OTP code itself as part of the history or evidence; what is retained is the **result** of that verification (method used and masked channel reference), in accordance with the Electronic Signature Policy.

## 6. General technical and security logs

Technical and security logs not directly linked to a specific signing operation (for example, infrastructure access logs, failed authentication attempts) are kept for **12 months**, a reasonable period for the detection and analysis of security incidents, after which they are automatically deleted.

## 7. Aggregated proprietary analytics

The internal and self-hosted analytics system of LSigner processes the IP address of each request in a **temporary** manner, solely for the calculation of aggregated usage statistics of the Platform. Once the corresponding aggregated data is computed, the individual IP address is neither retained nor stored in a historical or individualized manner.

## 8. Backups

The database backups (stored in an S3 container on the same Hostinger infrastructure in France) are maintained under a continuous rotation cycle, solely to ensure service recovery in the event of technical incidents. The backups are subject to the same security measures as the production data, and the data deleted from the production systems according to the previous deadlines are also deleted from the backups as they are rotated, without generating indefinite or permanently retained backups.

## 9. Deletion requests (right to be forgotten) and their limits

When a User requests the deletion of their personal data in accordance with their right to erasure, LSigner will address this request regarding account data and any data not subject to a legal obligation of retention. However, in accordance with Article 17.3.b) of the GDPR, **it will not be possible to delete the signed documents or the signature evidence before the retention period indicated in section 2 has elapsed**, as this retention is required by law and is necessary to preserve the evidentiary value of the signature against third parties, including the User who requested it.

## 10. Extraordinary preservation due to litigation or requirement

In the event that a document, evidence, or data is related to ongoing litigation, judicial proceedings, or a request from a competent authority, LSigner may retain such information beyond the general timeframes indicated in this document, for the strictly necessary period to comply with said procedure or request.

## 11. Deletion or anonymization upon expiration

Once the retention periods indicated in this document have elapsed, the corresponding data is permanently deleted or irreversibly anonymized, so that it is no longer possible to associate it with an identified or identifiable person.

## 12. Review of this Policy

LSigner may review the retention periods indicated in this document to adapt them to regulatory, jurisprudential, or technical infrastructure changes of the service itself. Any relevant changes will be reflected by updating the "last updated" date at the beginning of this document.
