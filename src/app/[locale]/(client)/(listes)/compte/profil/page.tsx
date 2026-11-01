import { getTranslations } from "next-intl/server";
import { DeleteAccount } from "@/features/auth/components/delete-account";
import { ProfileForm } from "@/features/auth/components/profile-form";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function ProfilePage() {
  const viewer = await requireViewer("/compte/profil");
  const t = await getTranslations("account");

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">{t("profileTitle")}</h1>
      <div className="mt-8">
        <ProfileForm
          defaults={{
            displayName: viewer.displayName,
            phone: viewer.phone?.replace(/^\+216/, "") ?? "",
            locale: viewer.locale,
          }}
        />
      </div>
      <DeleteAccount />
    </>
  );
}
