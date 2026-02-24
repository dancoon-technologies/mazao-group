# Full sub-counties for all 47 counties (Kenya). 0002 had a sample; this completes the set.
# Source: official/admin lists (314 sub-counties as of 2023). get_or_create avoids duplicates.

from django.db import migrations


def seed_sub_counties_full(apps, schema_editor):
    County = apps.get_model("locations", "County")
    SubCounty = apps.get_model("locations", "SubCounty")
    # (county_name, sub_county_name) - all 47 counties with their sub-counties
    data = [
        ("Mombasa", "Changamwe"), ("Mombasa", "Jomvu"), ("Mombasa", "Kisauni"), ("Mombasa", "Likoni"),
        ("Mombasa", "Mvita"), ("Mombasa", "Nyali"),
        ("Kwale", "Kinango"), ("Kwale", "Lunga Lunga"), ("Kwale", "Matuga"), ("Kwale", "Msambweni"),
        ("Kilifi", "Ganze"), ("Kilifi", "Kaloleni"), ("Kilifi", "Kilifi North"), ("Kilifi", "Kilifi South"),
        ("Kilifi", "Magarini"), ("Kilifi", "Malindi"), ("Kilifi", "Rabai"),
        ("Tana River", "Bura"), ("Tana River", "Galole"), ("Tana River", "Garsen"),
        ("Lamu", "Lamu East"), ("Lamu", "Lamu West"),
        ("Taita-Taveta", "Mwatate"), ("Taita-Taveta", "Taveta"), ("Taita-Taveta", "Voi"), ("Taita-Taveta", "Wundanyi"),
        ("Garissa", "Balambala"), ("Garissa", "Dadaab"), ("Garissa", "Fafi"), ("Garissa", "Garissa Township"),
        ("Garissa", "Hulugho"), ("Garissa", "Ijara"), ("Garissa", "Lagdera"),
        ("Wajir", "Eldas"), ("Wajir", "Tarbaj"), ("Wajir", "Wajir East"), ("Wajir", "Wajir North"),
        ("Wajir", "Wajir South"), ("Wajir", "Wajir West"),
        ("Mandera", "Banissa"), ("Mandera", "Lafey"), ("Mandera", "Mandera East"), ("Mandera", "Mandera North"),
        ("Mandera", "Mandera South"), ("Mandera", "Mandera West"),
        ("Marsabit", "Laisamis"), ("Marsabit", "Moyale"), ("Marsabit", "North Horr"), ("Marsabit", "Saku"),
        ("Isiolo", "Garbatulla"), ("Isiolo", "Isiolo"), ("Isiolo", "Merti"),
        ("Meru", "Buuri"), ("Meru", "Igembe Central"), ("Meru", "Igembe North"), ("Meru", "Igembe South"),
        ("Meru", "Imenti Central"), ("Meru", "Imenti North"), ("Meru", "Imenti South"),
        ("Meru", "Tigania East"), ("Meru", "Tigania West"),
        ("Tharaka-Nithi", "Chuka"), ("Tharaka-Nithi", "Maara"), ("Tharaka-Nithi", "Tharaka"),
        ("Embu", "Manyatta"), ("Embu", "Mbeere North"), ("Embu", "Mbeere South"), ("Embu", "Runyenjes"),
        ("Kitui", "Kitui Central"), ("Kitui", "Kitui East"), ("Kitui", "Kitui Rural"), ("Kitui", "Kitui South"),
        ("Kitui", "Kitui West"), ("Kitui", "Mwingi Central"), ("Kitui", "Mwingi North"), ("Kitui", "Mwingi West"),
        ("Machakos", "Kathiani"), ("Machakos", "Machakos Town"), ("Machakos", "Masinga"), ("Machakos", "Matungulu"),
        ("Machakos", "Mavoko"), ("Machakos", "Mwala"), ("Machakos", "Yatta"),
        ("Makueni", "Kaiti"), ("Makueni", "Kibwezi East"), ("Makueni", "Kibwezi West"), ("Makueni", "Kilome"),
        ("Makueni", "Makueni"), ("Makueni", "Mbooni"),
        ("Nyandarua", "Kinangop"), ("Nyandarua", "Kipipiri"), ("Nyandarua", "Ndaragwa"), ("Nyandarua", "Ol Kalou"),
        ("Nyandarua", "Ol Joro Orok"),
        ("Nyeri", "Kieni East"), ("Nyeri", "Kieni West"), ("Nyeri", "Mathira East"), ("Nyeri", "Mathira West"),
        ("Nyeri", "Mukurweini"), ("Nyeri", "Nyeri Town"), ("Nyeri", "Othaya"), ("Nyeri", "Tetu"),
        ("Kirinyaga", "Kirinyaga Central"), ("Kirinyaga", "Kirinyaga East"), ("Kirinyaga", "Kirinyaga West"),
        ("Kirinyaga", "Mwea East"), ("Kirinyaga", "Mwea West"),
        ("Murang'a", "Gatanga"), ("Murang'a", "Kahuro"), ("Murang'a", "Kandara"), ("Murang'a", "Kangema"),
        ("Murang'a", "Kigumo"), ("Murang'a", "Kiharu"), ("Murang'a", "Mathioya"), ("Murang'a", "Murang'a South"),
        ("Kiambu", "Gatundu North"), ("Kiambu", "Gatundu South"), ("Kiambu", "Githunguri"), ("Kiambu", "Juja"),
        ("Kiambu", "Kabete"), ("Kiambu", "Kiambaa"), ("Kiambu", "Kiambu"), ("Kiambu", "Kikuyu"), ("Kiambu", "Lari"),
        ("Kiambu", "Limuru"), ("Kiambu", "Ruiru"), ("Kiambu", "Thika Town"),
        ("Turkana", "Loima"), ("Turkana", "Turkana Central"), ("Turkana", "Turkana North"), ("Turkana", "Turkana South"),
        ("Turkana", "Turkana West"),
        ("West Pokot", "Kipkomo"), ("West Pokot", "Pokot Central"), ("West Pokot", "Pokot South"), ("West Pokot", "Sigor"),
        ("Samburu", "Samburu East"), ("Samburu", "Samburu North"), ("Samburu", "Samburu West"),
        ("Trans-Nzoia", "Cherangany"), ("Trans-Nzoia", "Endebess"), ("Trans-Nzoia", "Kiminini"),
        ("Trans-Nzoia", "Kwanza"), ("Trans-Nzoia", "Saboti"),
        ("Uasin Gishu", "Ainabkoi"), ("Uasin Gishu", "Kapseret"), ("Uasin Gishu", "Kesses"), ("Uasin Gishu", "Moiben"),
        ("Uasin Gishu", "Soy"), ("Uasin Gishu", "Turbo"),
        ("Elgeyo-Marakwet", "Keiyo North"), ("Elgeyo-Marakwet", "Keiyo South"), ("Elgeyo-Marakwet", "Marakwet East"),
        ("Elgeyo-Marakwet", "Marakwet West"),
        ("Nandi", "Aldai"), ("Nandi", "Chesumei"), ("Nandi", "Emgwen"), ("Nandi", "Mosop"), ("Nandi", "Nandi Hills"),
        ("Nandi", "Tindiret"),
        ("Baringo", "Baringo Central"), ("Baringo", "Baringo North"), ("Baringo", "Baringo South"),
        ("Baringo", "Eldama Ravine"), ("Baringo", "Mogotio"), ("Baringo", "Tiaty"),
        ("Laikipia", "Laikipia Central"), ("Laikipia", "Laikipia East"), ("Laikipia", "Laikipia North"),
        ("Laikipia", "Laikipia West"), ("Laikipia", "Nyahururu"),
        ("Nakuru", "Bahati"), ("Nakuru", "Gilgil"), ("Nakuru", "Kuresoi North"), ("Nakuru", "Kuresoi South"),
        ("Nakuru", "Molo"), ("Nakuru", "Naivasha"), ("Nakuru", "Nakuru Town East"), ("Nakuru", "Nakuru Town West"),
        ("Nakuru", "Njoro"), ("Nakuru", "Rongai"), ("Nakuru", "Subukia"),
        ("Narok", "Narok East"), ("Narok", "Narok North"), ("Narok", "Narok South"), ("Narok", "Narok West"),
        ("Narok", "Transmara East"), ("Narok", "Transmara West"),
        ("Kajiado", "Isinya"), ("Kajiado", "Kajiado Central"), ("Kajiado", "Kajiado North"), ("Kajiado", "Loitokitok"),
        ("Kajiado", "Mashuuru"),
        ("Kericho", "Ainamoi"), ("Kericho", "Belgut"), ("Kericho", "Bureti"), ("Kericho", "Kipkelion East"),
        ("Kericho", "Kipkelion West"), ("Kericho", "Soin Sigowet"),
        ("Bomet", "Bomet Central"), ("Bomet", "Bomet East"), ("Bomet", "Chepalungu"), ("Bomet", "Konoin"),
        ("Bomet", "Sotik"),
        ("Kakamega", "Butere"), ("Kakamega", "Kakamega Central"), ("Kakamega", "Kakamega East"),
        ("Kakamega", "Kakamega North"), ("Kakamega", "Kakamega South"), ("Kakamega", "Khwisero"),
        ("Kakamega", "Lugari"), ("Kakamega", "Likuyani"), ("Kakamega", "Lurambi"), ("Kakamega", "Matete"),
        ("Kakamega", "Mumias"), ("Kakamega", "Mutungu"), ("Kakamega", "Navakholo"),
        ("Vihiga", "Emuhaya"), ("Vihiga", "Hamisi"), ("Vihiga", "Luanda"), ("Vihiga", "Sabatia"), ("Vihiga", "Vihiga"),
        ("Bungoma", "Bumula"), ("Bungoma", "Kabuchai"), ("Bungoma", "Kanduyi"), ("Bungoma", "Kimilil"),
        ("Bungoma", "Mt Elgon"), ("Bungoma", "Sirisia"), ("Bungoma", "Tongaren"), ("Bungoma", "Webuye East"),
        ("Bungoma", "Webuye West"),
        ("Busia", "Budalangi"), ("Busia", "Butula"), ("Busia", "Funyula"), ("Busia", "Nambale"),
        ("Busia", "Teso North"), ("Busia", "Teso South"),
        ("Siaya", "Alego Usonga"), ("Siaya", "Bondo"), ("Siaya", "Gem"), ("Siaya", "Rarieda"),
        ("Siaya", "Ugenya"), ("Siaya", "Unguja"),
        ("Kisumu", "Kisumu Central"), ("Kisumu", "Kisumu East"), ("Kisumu", "Kisumu West"), ("Kisumu", "Muhoroni"),
        ("Kisumu", "Nyakach"), ("Kisumu", "Nyando"), ("Kisumu", "Seme"),
        ("Homa Bay", "Homa Bay Town"), ("Homa Bay", "Kabondo"), ("Homa Bay", "Karachuonyo"), ("Homa Bay", "Kasipul"),
        ("Homa Bay", "Mbita"), ("Homa Bay", "Ndhiwa"), ("Homa Bay", "Rangwe"), ("Homa Bay", "Suba"),
        ("Migori", "Awendo"), ("Migori", "Kuria East"), ("Migori", "Kuria West"), ("Migori", "Mabera"),
        ("Migori", "Ntimaru"), ("Migori", "Rongo"), ("Migori", "Suna East"), ("Migori", "Suna West"), ("Migori", "Uriri"),
        ("Kisii", "Bobasi"), ("Kisii", "Bomachoge Borabu"), ("Kisii", "Bomachoge Chache"), ("Kisii", "Kitutu Chache North"),
        ("Kisii", "Kitutu Chache South"), ("Kisii", "Nyaribari Chache"), ("Kisii", "Nyaribari Masaba"),
        ("Nyamira", "Borabu"), ("Nyamira", "Manga"), ("Nyamira", "Masaba North"), ("Nyamira", "Nyamira North"),
        ("Nyamira", "Nyamira South"),
        ("Nairobi", "Dagoretti North"), ("Nairobi", "Dagoretti South"), ("Nairobi", "Embakasi Central"),
        ("Nairobi", "Embakasi East"), ("Nairobi", "Embakasi North"), ("Nairobi", "Embakasi South"),
        ("Nairobi", "Embakasi West"), ("Nairobi", "Kamukunji"), ("Nairobi", "Kasarani"), ("Nairobi", "Kibra"),
        ("Nairobi", "Langata"), ("Nairobi", "Makadara"), ("Nairobi", "Mathare"), ("Nairobi", "Roysambu"),
        ("Nairobi", "Ruaraka"), ("Nairobi", "Starehe"), ("Nairobi", "Westlands"),
    ]
    for county_name, sub_name in data:
        try:
            county = County.objects.get(name=county_name)
            SubCounty.objects.get_or_create(county=county, name=sub_name)
        except County.DoesNotExist:
            pass  # county not in DB (should not happen if 0002 ran)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [("locations", "0002_seed_kenya")]

    operations = [migrations.RunPython(seed_sub_counties_full, noop)]
