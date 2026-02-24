# Data migration: seed Kenya regions, counties, sub-counties (IDs for minimal storage)

from django.db import migrations


def seed_regions(apps, schema_editor):
    Region = apps.get_model("locations", "Region")
    for name in [
        "Central", "Coast", "Eastern", "Nairobi", "North Eastern",
        "Nyanza", "Rift Valley", "Western",
    ]:
        Region.objects.get_or_create(name=name)


def seed_counties(apps, schema_editor):
    Region = apps.get_model("locations", "Region")
    County = apps.get_model("locations", "County")
    # (region_name, county_name)
    data = [
        ("Coast", "Mombasa"), ("Coast", "Kwale"), ("Coast", "Kilifi"), ("Coast", "Tana River"),
        ("Coast", "Lamu"), ("Coast", "Taita-Taveta"),
        ("North Eastern", "Garissa"), ("North Eastern", "Wajir"), ("North Eastern", "Mandera"),
        ("Eastern", "Marsabit"), ("Eastern", "Isiolo"), ("Eastern", "Meru"), ("Eastern", "Tharaka-Nithi"),
        ("Eastern", "Embu"), ("Eastern", "Kitui"), ("Eastern", "Machakos"), ("Eastern", "Makueni"),
        ("Central", "Nyandarua"), ("Central", "Nyeri"), ("Central", "Kirinyaga"), ("Central", "Murang'a"),
        ("Central", "Kiambu"),
        ("Rift Valley", "Turkana"), ("Rift Valley", "West Pokot"), ("Rift Valley", "Samburu"),
        ("Rift Valley", "Trans-Nzoia"), ("Rift Valley", "Uasin Gishu"), ("Rift Valley", "Elgeyo-Marakwet"),
        ("Rift Valley", "Nandi"), ("Rift Valley", "Baringo"), ("Rift Valley", "Laikipia"),
        ("Rift Valley", "Nakuru"), ("Rift Valley", "Narok"), ("Rift Valley", "Kajiado"),
        ("Rift Valley", "Kericho"), ("Rift Valley", "Bomet"),
        ("Western", "Kakamega"), ("Western", "Vihiga"), ("Western", "Bungoma"), ("Western", "Busia"),
        ("Nyanza", "Siaya"), ("Nyanza", "Kisumu"), ("Nyanza", "Homa Bay"), ("Nyanza", "Migori"),
        ("Nyanza", "Kisii"), ("Nyanza", "Nyamira"),
        ("Nairobi", "Nairobi"),
    ]
    for region_name, county_name in data:
        region = Region.objects.get(name=region_name)
        County.objects.get_or_create(region=region, name=county_name)


def seed_sub_counties(apps, schema_editor):
    County = apps.get_model("locations", "County")
    SubCounty = apps.get_model("locations", "SubCounty")
    # (county_name, sub_county_name)
    data = [
        ("Mombasa", "Mvita"), ("Mombasa", "Nyali"), ("Mombasa", "Likoni"), ("Mombasa", "Kisauni"),
        ("Mombasa", "Changamwe"), ("Mombasa", "Jomvu"),
        ("Kwale", "Matuga"), ("Kwale", "Msambweni"), ("Kwale", "Lunga Lunga"), ("Kwale", "Kinango"),
        ("Kilifi", "Kilifi North"), ("Kilifi", "Kilifi South"), ("Kilifi", "Malindi"), ("Kilifi", "Ganze"),
        ("Nairobi", "Westlands"), ("Nairobi", "Dagoretti North"), ("Nairobi", "Dagoretti South"),
        ("Nairobi", "Langata"), ("Nairobi", "Kibra"), ("Nairobi", "Roysambu"), ("Nairobi", "Embakasi South"),
        ("Nairobi", "Embakasi North"), ("Nairobi", "Starehe"), ("Nairobi", "Mathare"),
        ("Kiambu", "Kiambu"), ("Kiambu", "Limuru"), ("Kiambu", "Kabete"), ("Kiambu", "Lari"),
        ("Nakuru", "Nakuru Town East"), ("Nakuru", "Nakuru Town West"), ("Nakuru", "Nakuru North"),
        ("Nakuru", "Naivasha"), ("Nakuru", "Gilgil"),
        ("Kisumu", "Kisumu Central"), ("Kisumu", "Kisumu East"), ("Kisumu", "Kisumu West"),
        ("Kakamega", "Kakamega Central"), ("Kakamega", "Lugari"), ("Kakamega", "Likuyani"),
        ("Meru", "Meru Central"), ("Meru", "Meru South"), ("Meru", "Meru North"), ("Meru", "Tigania"),
        ("Garissa", "Garissa Township"), ("Garissa", "Lagdera"), ("Garissa", "Fafi"), ("Garissa", "Dadaab"),
    ]
    for county_name, sub_name in data:
        county = County.objects.get(name=county_name)
        SubCounty.objects.get_or_create(county=county, name=sub_name)


def seed_all(apps, schema_editor):
    seed_regions(apps, schema_editor)
    seed_counties(apps, schema_editor)
    seed_sub_counties(apps, schema_editor)


def reverse_seed(apps, schema_editor):
    SubCounty = apps.get_model("locations", "SubCounty")
    County = apps.get_model("locations", "County")
    Region = apps.get_model("locations", "Region")
    SubCounty.objects.all().delete()
    County.objects.all().delete()
    Region.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [("locations", "0001_initial")]

    operations = [migrations.RunPython(seed_all, reverse_seed)]
