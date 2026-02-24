class SetDefaultSocialLinks < ActiveRecord::Migration[8.1]
  def up
    Campaign.find_each do |campaign|
      campaign.update_columns(
        instagram_url: campaign.instagram_url || "https://www.instagram.com/joshtina2026",
        facebook_url: campaign.facebook_url || "https://www.facebook.com/joshtina2026",
        tiktok_url: campaign.tiktok_url || "https://www.tiktok.com/@joshtina2026"
      )
    end
  end

  def down
    # No-op: links can be edited via admin UI
  end
end
