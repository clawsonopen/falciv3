# Identity Registry

Bu klasör, uygulamadaki tum kimlikleri rol bazli ayri tutmak için kullanilir.

## Klasör Kurali

- `assistants/`: LLM persona ve sistem instruction kimlikleri.
- `users/`: Gercek kullanıcı profilleri ve kullanıcının oluşturduğu diğer insan kimlikleri.

## Neden Ayri?

- Falcilar ile kullanıcı profilleri ayni semaya zorlanmaz.
- Aile uyeleri, yeni personelar ve yeni uzmanliklar eklenirken dosyalar karismaz.
- Prompt builder sadece `assistants/` altini okuyabilir; profil sistemi sadece `users/` altini okuyabilir.

## Onerilen Yol

- Her assistant kimliği kendi klasorunde tutulur:
  - `assistants/<group>/<persona-id>/identity.md`
- Her kullanıcı veya kullanıcı kimliği ayri klasorde tutulur:
  - `users/<user-id>/profile.md`
  - `users/<user-id>/personas/<persona-id>.md`

## Uzmanlik Modeli

Bir falci için tek bir `primary_domain` tanimlanir.
Yan alanlar `secondary_domains` listesinde tutulur.
Boylece Suzan Hanim bugun kahve falinin ana karakteri olurken, ileride astro fal veya kağıt falı gibi alanlar yan branş olarak eklenebilir.
